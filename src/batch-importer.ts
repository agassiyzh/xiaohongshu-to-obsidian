import fs from "fs/promises";
import path from "path";
import { XHSImporter } from "./xhs-importer";
import { AIClassifier } from "./ai-classifier";
import { FileManager } from "./file-manager";
import { ConfigManager } from "./config";
import { ImportHistory, ImportRecord } from "./import-history";
import { XHSNote, ImportResult, Config } from "./types";
import chalk from "chalk";
import ora from "ora";

export interface BatchImportOptions {
	filePath?: string;
	urls?: string[];
	downloadMedia?: boolean;
	downloadOnlyRelevantMedia?: boolean; // 新选项：视频只下载视频，图片只下载图片
	forceReimport?: boolean;
	skipDuplicates?: boolean;
	category?: string;
	parallel?: number;
}

export interface BatchImportResult {
	total: number;
	successful: number;
	skipped: number;
	failed: number;
	results: ImportResult[];
	skippedItems: { url: string; reason: string }[];
	errors: { url: string; error: string }[];
	statistics: {
		duration: number;
		averageTime: number;
		categories: { [category: string]: number };
	};
}

export class BatchImporter {
	private xhsImporter!: XHSImporter;
	private configManager: ConfigManager;
	private fileManager!: FileManager;
	private aiClassifier?: AIClassifier;
	private importHistory!: ImportHistory;

	constructor(configDir?: string) {
		this.configManager = new ConfigManager(configDir);
	}

	async initialize(): Promise<void> {
		const config = await this.configManager.loadConfig();
		this.fileManager = new FileManager(
			config.baseFolder,
			config.output.createMediaFolder,
			config.basePath, // 传递自定义基础路径
		);
		this.importHistory = new ImportHistory(
			this.fileManager.getFullBasePath(),
		); // 使用完整的基础路径
		this.xhsImporter = new XHSImporter(config.antiBot);

		// Load import history
		await this.importHistory.loadHistory();

		// Initialize AI classifier if enabled
		if (config.ai.enabled && config.ai.apiKey) {
			this.aiClassifier = new AIClassifier(config.ai);
		}

		// Ensure base folder exists
		await this.fileManager.createFolderStructure(
			this.fileManager.getFullBasePath(),
		);
	}

	/**
	 * 从文件读取URL列表
	 */
	async readUrlsFromFile(filePath: string): Promise<string[]> {
		try {
			const content = await fs.readFile(filePath, "utf-8");
			const urls = content
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("#")) // 忽略空行和注释
				.filter(
					(line) =>
						line.includes("xiaohongshu.com") ||
						line.includes("xhslink.com"),
				);

			return urls;
		} catch (error) {
			throw new Error(
				`Failed to read URLs from ${filePath}: ${(error as Error).message}`,
			);
		}
	}

	/**
	 * 从文本中提取所有小红书URL
	 */
	extractUrlsFromText(text: string): string[] {
		const urlRegex =
			/(https:\/\/www\.xiaohongshu\.com\/explore\/[^\s,，]+)|(http:\/\/xhslink\.com\/a?o?\/[^\s,，]+)/g;
		const matches = text.match(urlRegex) || [];
		return matches.map((url) => url.trim());
	}

	/**
	 * 批量导入
	 */
	async batchImport(options: BatchImportOptions): Promise<BatchImportResult> {
		const startTime = Date.now();
		const spinner = ora("准备批量导入...").start();

		try {
			// 获取URL列表
			let urls: string[] = [];

			if (options.filePath) {
				urls = await this.readUrlsFromFile(options.filePath);
				spinner.text = `从文件读取到 ${urls.length} 个URL`;
			} else if (options.urls) {
				urls = options.urls;
				spinner.text = `准备导入 ${urls.length} 个URL`;
			} else {
				throw new Error("请提供文件路径或URL列表");
			}

			if (urls.length === 0) {
				spinner.fail("没有找到有效的URL");
				return {
					total: 0,
					successful: 0,
					skipped: 0,
					failed: 0,
					results: [],
					skippedItems: [],
					errors: [],
					statistics: {
						duration: 0,
						averageTime: 0,
						categories: {},
					},
				};
			}

			const config = await this.configManager.loadConfig();
			const parallel = Math.min(options.parallel || 3, 10); // 限制最大并发数

			spinner.text = `开始批量导入 ${urls.length} 个笔记 (并发数: ${parallel})`;

			const results: ImportResult[] = [];
			const skippedItems: { url: string; reason: string }[] = [];
			const errors: { url: string; error: string }[] = [];
			const categories: { [category: string]: number } = {};

			// 并发处理URL
			const processUrl = async (url: string, index: number) => {
				try {
					// 检查是否已导入
					const noteId = this.xhsImporter.extractNoteIdFromUrl(url);
					if (
						noteId &&
						this.importHistory.hasImported(noteId) &&
						!options.forceReimport
					) {
						const record = this.importHistory.getRecord(noteId)!;
						skippedItems.push({
							url,
							reason: `已导入于 ${record.importedAt} (${record.filePath})`,
						});
						return null;
					}

					// 导入笔记
					const result = await this.importSingleNote(url, index, {
						downloadMedia:
							options.downloadMedia ?? config.downloadMedia,
						category: options.category,
					});

					if (result.success) {
						// 添加到导入历史
						if (noteId) {
							// 重新获取note数据用于记录
							const note = await this.xhsImporter.importXHSNote(
								url,
								index,
							);
							const record: ImportRecord = {
								id: note.id,
								title: note.title,
								url: note.url,
								category: result.category,
								filePath: result.filePath,
								importedAt: new Date().toISOString(),
								tags: note.tags,
								isVideo: note.isVideo,
							};
							await this.importHistory.addRecord(record);
						}

						return result;
					} else {
						errors.push({
							url,
							error: result.error || "Unknown error",
						});
						return null;
					}
				} catch (error) {
					errors.push({
						url,
						error: (error as Error).message,
					});
					return null;
				}
			};

			// 分批并发处理
			const batchSize = parallel;
			for (
				let batchStart = 0;
				batchStart < urls.length;
				batchStart += batchSize
			) {
				const batchEnd = Math.min(batchStart + batchSize, urls.length);
				const batch = urls.slice(batchStart, batchEnd);

				spinner.text = `处理批次 ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(urls.length / batchSize)} (${batchStart + 1}-${batchEnd}/${urls.length})`;

				// 并发处理当前批次
				const batchPromises = batch.map((url, index) =>
					processUrl(url, batchStart + index),
				);

				const batchResults = await Promise.allSettled(batchPromises);

				// 收集成功的结果
				batchResults.forEach((result, index) => {
					if (result.status === "fulfilled" && result.value) {
						results.push(result.value);
						const category = result.value.category;
						categories[category] = (categories[category] || 0) + 1;
					}
				});

				// 批次间添加延迟（避免过于频繁的请求）
				if (batchEnd < urls.length) {
					spinner.text = `批次间延迟...`;
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}
			}

			const endTime = Date.now();
			const duration = endTime - startTime;

			spinner.succeed(`批量导入完成！`);

			// 显示结果摘要
			console.log(chalk.blue("\n📊 导入结果摘要:"));
			console.log(chalk.green(`✅ 成功: ${results.length}`));
			console.log(chalk.yellow(`⏭️  跳过: ${skippedItems.length}`));
			console.log(chalk.red(`❌ 失败: ${errors.length}`));
			console.log(
				chalk.blue(`⏱️  耗时: ${(duration / 1000).toFixed(2)}秒`),
			);

			if (Object.keys(categories).length > 0) {
				console.log(chalk.cyan("\n📂 分类统计:"));
				Object.entries(categories).forEach(([category, count]) => {
					console.log(`   ${category}: ${count}`);
				});
			}

			if (skippedItems.length > 0) {
				console.log(chalk.yellow("\n⏭️  跳过的项目:"));
				skippedItems.slice(0, 5).forEach((item) => {
					console.log(`   ${item.reason}`);
				});
				if (skippedItems.length > 5) {
					console.log(`   ... 还有 ${skippedItems.length - 5} 项`);
				}
			}

			if (errors.length > 0) {
				console.log(chalk.red("\n❌ 失败的项目:"));
				errors.slice(0, 5).forEach((item) => {
					console.log(`   ${item.url}: ${item.error}`);
				});
				if (errors.length > 5) {
					console.log(`   ... 还有 ${errors.length - 5} 项`);
				}
			}

			return {
				total: urls.length,
				successful: results.length,
				skipped: skippedItems.length,
				failed: errors.length,
				results,
				skippedItems,
				errors,
				statistics: {
					duration,
					averageTime: duration / urls.length,
					categories,
				},
			};
		} catch (error) {
			spinner.fail(`批量导入失败: ${(error as Error).message}`);
			throw error;
		}
	}

	/**
	 * 导入单个笔记
	 */
	private async importSingleNote(
		url: string,
		requestIndex: number,
		options: {
			downloadMedia?: boolean;
			downloadOnlyRelevantMedia?: boolean;
			category?: string;
		},
	): Promise<ImportResult> {
		// 导入笔记数据
		const note = await this.xhsImporter.importXHSNote(url, requestIndex);

		const config = await this.configManager.loadConfig();

		// 确定分类
		let category = options.category;
		if (!category) {
			if (this.aiClassifier && config.ai.enabled) {
				category = await this.aiClassifier.categorizeNote(
					note,
					config.categories,
				);
			} else {
				// 使用关键词分类
				category = AIClassifier.keywordBasedCategorize(
					note,
					config.categories,
				);
			}
		}

		// 设置分类
		note.category = category;

		// 创建文件
		const downloadMedia = options.downloadMedia ?? config.downloadMedia;

		// 如果启用了智能媒体下载，视频笔记和图片笔记有不同的下载策略
		if (options.downloadOnlyRelevantMedia && downloadMedia) {
			// 视频笔记：只下载视频，不下载图片
			// 图片笔记：只下载图片，不下载视频
			// 这个逻辑已经在 FileManager.createNote 中实现了
			return await this.fileManager.createNote(note, category, true);
		}

		return await this.fileManager.createNote(note, category, downloadMedia);
	}

	/**
	 * 获取导入历史统计
	 */
	getImportStatistics() {
		return this.importHistory.getStatistics();
	}

	/**
	 * 清空导入历史
	 */
	async clearImportHistory(): Promise<void> {
		await this.importHistory.clearHistory();
	}

	/**
	 * 导出导入历史
	 */
	async exportImportHistory(filePath: string): Promise<void> {
		await this.importHistory.exportHistory(filePath);
	}
}
