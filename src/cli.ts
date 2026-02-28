#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { XHSStandaloneImporter } from "./index";
import { BatchImporter } from "./batch-importer";
import { MediaReplacer } from "./media-replacer";
import { Config, S3Config } from "./types";
import path from "path";
import fs from "fs/promises";

const program = new Command();

program
	.name("xhs-import")
	.description(
		"Standalone Xiaohongshu importer with AI-powered categorization",
	)
	.version("2.0.0");

// Import command
program
	.command("import")
	.description("Import a Xiaohongshu note")
	.option("-u, --url <url>", "Direct URL to import")
	.option("-c, --category <category>", "Force specific category")
	.option("-d, --download-media", "Download media files locally")
	.option("--no-download-media", "Do not download media files")
	.option("--s3", "Upload media to S3 during import")
	.option("--s3-only", "Only upload to S3, no local storage")
	.action(async (options) => {
		try {
			const importer = new XHSStandaloneImporter();
			await importer.initialize();

			const s3Config = await importer.getS3Config();
			
			if ((options.s3 || options.s3Only) && !s3Config.enabled) {
				console.error(chalk.red("❌ S3 未启用，请先配置 S3"));
				console.log(chalk.cyan("运行: xhs-import config --enable-s3"));
				process.exit(1);
			}

			let shareText: string;

			if (options.url) {
				shareText = options.url;
			} else {
				const answer = await inquirer.prompt([
					{
						type: "input",
						name: "shareText",
						message: "请粘贴小红书分享文本或URL:",
						validate: (input) => {
							if (!input.trim()) {
								return "请输入分享文本或URL";
							}
							return true;
						},
					},
				]);
				shareText = answer.shareText;
			}

			const spinner = ora("正在导入笔记...").start();

			try {
				const uploadToS3 = options.s3 || options.s3Only;
				
				const result = await importer.importFromShareText(shareText, {
					downloadMedia: options.downloadMedia,
					forceCategory: options.category,
					uploadToS3,
				});

				spinner.stop();

				if (result.success) {
					console.log(chalk.green("✅ 导入成功!"));
					console.log(chalk.blue(`📁 文件路径: ${result.filePath}`));
					console.log(chalk.cyan(`📂 分类: ${result.category}`));
					if (result.mediaFiles.length > 0) {
						console.log(
							chalk.yellow(
								`📸 媒体文件: ${result.mediaFiles.length} 个`,
							),
						);
					}
					if (result.mediaUrls && result.mediaUrls.length > 0) {
						console.log(
							chalk.cyan(
								`☁️ S3 URL: ${result.mediaUrls.length} 个`,
							),
						);
					}
				} else {
					console.error(chalk.red("❌ 导入失败:"), result.error);
				}
			} catch (error) {
				spinner.stop();
				throw error;
			}
		} catch (error) {
			console.error(chalk.red("❌ 错误:"), (error as Error).message);
			process.exit(1);
		}
	});

// Config command
program
	.command("config")
	.description("Configure the importer")
	.option("--show", "Show current configuration")
	.option("--show-s3", "Show S3 configuration")
	.option("--set-ai-key <key>", "Set AI API key")
	.option(
		"--set-ai-provider <provider>",
		"Set AI provider (openai/anthropic/deepseek)",
	)
	.option("--set-base-folder <folder>", "Set base folder for imports")
	.option("--enable-ai", "Enable AI categorization")
	.option("--disable-ai", "Disable AI categorization")
	.option("--enable-s3", "Enable S3 upload")
	.option("--disable-s3", "Disable S3 upload")
	.option("--set-s3-endpoint <url>", "Set S3 endpoint")
	.option("--set-s3-bucket <name>", "Set S3 bucket")
	.option("--set-s3-access-key <key>", "Set S3 access key")
	.option("--set-s3-secret-key <key>", "Set S3 secret key")
	.option("--set-s3-provider <provider>", "Set S3 provider (aws/minio/aliyun/tencent)")
	.option("--set-s3-region <region>", "Set S3 region")
	.option("--set-s3-path-prefix <prefix>", "Set S3 path prefix")
	.option("--set-s3-strategy <strategy>", "Set upload strategy (s3-only/local-only/both)")
	.action(async (options) => {
		try {
			const importer = new XHSStandaloneImporter();
			await importer.initialize();

			if (options.show) {
				const config = await importer.getConfig();
				console.log(chalk.blue("当前配置:"));
				console.log(JSON.stringify(config, null, 2));
				return;
			}

			const updates: Partial<Config> = {};

			if (options.setAiKey) {
				if (!options.setAiProvider) {
					const answer = await inquirer.prompt([
						{
							type: "list",
							name: "provider",
							message: "选择AI提供商:",
							choices: ["openai", "anthropic", "deepseek"],
						},
					]);
					options.setAiProvider = answer.provider;
				}

				updates.ai = {
					...(await importer.getConfig()).ai,
					enabled: true,
					apiKey: options.setAiKey,
					provider: options.setAiProvider as
						| "openai"
						| "anthropic"
						| "deepseek",
				};
			}

			if (options.setBaseFolder) {
				updates.baseFolder = options.setBaseFolder;
			}

			if (options.enableAi) {
				const currentConfig = await importer.getConfig();
				updates.ai = {
					...currentConfig.ai,
					enabled: true,
				};
			}

			if (options.disableAi) {
				const currentConfig = await importer.getConfig();
				updates.ai = {
					...currentConfig.ai,
					enabled: false,
				};
			}

			if (options.showS3) {
				const s3Config = await importer.getS3Config();
				console.log(chalk.blue("S3 配置:"));
				console.log(JSON.stringify(s3Config, null, 2));
				return;
			}

			const s3Updates: Partial<S3Config> = {};
			
			if (options.enableS3) {
				s3Updates.enabled = true;
			}
			
			if (options.disableS3) {
				s3Updates.enabled = false;
			}
			
			if (options.setS3Endpoint) {
				s3Updates.endpoint = options.setS3Endpoint;
			}
			
			if (options.setS3Bucket) {
				s3Updates.bucket = options.setS3Bucket;
			}
			
			if (options.setS3AccessKey) {
				s3Updates.accessKey = options.setS3AccessKey;
			}
			
			if (options.setS3SecretKey) {
				s3Updates.secretKey = options.setS3SecretKey;
			}
			
			if (options.setS3Provider) {
				s3Updates.provider = options.setS3Provider as S3Config["provider"];
			}
			
			if (options.setS3Region) {
				s3Updates.region = options.setS3Region;
			}
			
			if (options.setS3PathPrefix) {
				s3Updates.pathPrefix = options.setS3PathPrefix;
			}
			
			if (options.setS3Strategy) {
				s3Updates.uploadStrategy = options.setS3Strategy as S3Config["uploadStrategy"];
			}

			if (Object.keys(s3Updates).length > 0) {
				await importer.updateS3Config(s3Updates);
				console.log(chalk.green("✅ S3 配置已更新"));
				return;
			}

			if (Object.keys(updates).length > 0) {
				await importer.updateConfig(updates);
				console.log(chalk.green("✅ 配置已更新"));
			} else {
				// Interactive configuration
				const config = await importer.getConfig();

				const answers = await inquirer.prompt([
					{
						type: "input",
						name: "baseFolder",
						message: "基础文件夹:",
						default: config.baseFolder,
					},
					{
						type: "confirm",
						name: "downloadMedia",
						message: "默认下载媒体文件?",
						default: config.downloadMedia,
					},
					{
						type: "confirm",
						name: "enableAI",
						message: "启用AI分类?",
						default: config.ai.enabled,
					},
					{
						type: "list",
						name: "aiProvider",
						message: "AI提供商:",
						choices: ["openai", "anthropic", "deepseek"],
						when: (answers) => answers.enableAI,
						default: config.ai.provider,
					},
					{
						type: "password",
						name: "aiApiKey",
						message: "AI API Key:",
						when: (answers) => answers.enableAI,
						validate: (input) => {
							if (!input.trim()) {
								return "AI API Key 是必需的";
							}
							return true;
						},
					},
				]);

				const finalUpdates: Partial<Config> = {
					baseFolder: answers.baseFolder,
					downloadMedia: answers.downloadMedia,
					ai: {
						...config.ai,
						enabled: answers.enableAI,
						provider: answers.aiProvider,
						apiKey: answers.aiApiKey,
					},
				};

				await importer.updateConfig(finalUpdates);
				console.log(chalk.green("✅ 配置已更新"));
			}
		} catch (error) {
			console.error(chalk.red("❌ 配置错误:"), (error as Error).message);
			process.exit(1);
		}
	});

// Categories command
program
	.command("categories")
	.description("Show available categories")
	.action(async () => {
		try {
			const importer = new XHSStandaloneImporter();
			await importer.initialize();

			const categories = await importer.getCategories();
			console.log(chalk.blue("可用分类:"));
			categories.forEach((category, index) => {
				console.log(chalk.cyan(`${index + 1}. ${category}`));
			});
		} catch (error) {
			console.error(chalk.red("❌ 错误:"), (error as Error).message);
			process.exit(1);
		}
	});

// Interactive mode
program
	.command("interactive")
	.description("Start interactive mode")
	.action(async () => {
		try {
			const importer = new XHSStandaloneImporter();
			await importer.initialize();

			console.log(chalk.blue("🚀 小红书导入器 - 交互模式"));
			console.log(
				chalk.gray('输入 "help" 查看可用命令，输入 "exit" 退出'),
			);

			while (true) {
				const { command } = await inquirer.prompt([
					{
						type: "input",
						name: "command",
						message: chalk.green("xhs-import>"),
					},
				]);

				const cmd = command.trim().toLowerCase();

				if (cmd === "exit" || cmd === "quit") {
					console.log(chalk.yellow("👋 再见!"));
					break;
				} else if (cmd === "help") {
					console.log(chalk.blue("可用命令:"));
					console.log("  import     - 导入笔记");
					console.log("  config     - 配置设置");
					console.log("  categories - 查看分类");
					console.log("  exit       - 退出程序");
				} else if (cmd === "import") {
					const { shareText } = await inquirer.prompt([
						{
							type: "input",
							name: "shareText",
							message: "请粘贴小红书分享文本或URL:",
						},
					]);

					const spinner = ora("正在导入笔记...").start();

					try {
						const result =
							await importer.importFromShareText(shareText);
						spinner.stop();

						if (result.success) {
							console.log(chalk.green("✅ 导入成功!"));
							console.log(chalk.blue(`📁 ${result.filePath}`));
						} else {
							console.error(
								chalk.red("❌ 导入失败:"),
								result.error,
							);
						}
					} catch (error) {
						spinner.stop();
						console.error(
							chalk.red("❌ 错误:"),
							(error as Error).message,
						);
					}
				} else if (cmd === "categories") {
					const categories = await importer.getCategories();
					console.log(chalk.blue("可用分类:"));
					categories.forEach((category, index) => {
						console.log(chalk.cyan(`  ${index + 1}. ${category}`));
					});
				} else if (cmd === "config") {
					const config = await importer.getConfig();
					console.log(chalk.blue("当前配置:"));
					console.log(JSON.stringify(config, null, 2));
				} else if (cmd) {
					console.log(chalk.red(`未知命令: ${cmd}`));
					console.log(chalk.gray('输入 "help" 查看可用命令'));
				}
			}
		} catch (error) {
			console.error(chalk.red("❌ 错误:"), (error as Error).message);
			process.exit(1);
		}
	});

// Batch import command
program
	.command("batch")
	.description("Batch import from file or URLs")
	.option("-f, --file <path>", "File containing URLs (one per line)")
	.option("-u, --urls <urls>", "Comma-separated URLs")
	.option(
		"-c, --category <category>",
		"Force specific category for all items",
	)
	.option("-d, --download-media", "Download media files locally")
	.option("--no-download-media", "Do not download media files")
	.option(
		"--smart-media",
		"Download only relevant media (videos for video notes, images for image notes)",
	)
	.option("--force-reimport", "Reimport even if already imported")
	.option("-p, --parallel <number>", "Number of parallel imports", "3")
	.action(async (options) => {
		try {
			const batchImporter = new BatchImporter();
			await batchImporter.initialize();

			let urls: string[] = [];

			if (options.file) {
				// 从文件读取URL
				console.log(chalk.blue(`📖 从文件读取URL: ${options.file}`));
			} else if (options.urls) {
				// 从命令行参数获取URL
				urls = options.urls.split(",").map((url: string) => url.trim());
				console.log(chalk.blue(`🔗 处理 ${urls.length} 个URL`));
			} else {
				// 交互式输入
				const answer = await inquirer.prompt([
					{
						type: "input",
						name: "input",
						message: "请粘贴URL列表或文件路径:",
						validate: (input: string) => {
							if (!input.trim()) {
								return "请输入URL列表或文件路径";
							}
							return true;
						},
					},
				]);

				const input = answer.input.trim();

				// 判断是文件路径还是URL列表
				if (input.includes("\n") || input.includes("xiaohongshu.com")) {
					urls = batchImporter.extractUrlsFromText(input);
					console.log(chalk.blue(`🔗 提取到 ${urls.length} 个URL`));
				} else {
					// 尝试作为文件路径处理
					try {
						urls = await batchImporter.readUrlsFromFile(input);
						console.log(
							chalk.blue(`📖 从文件读取到 ${urls.length} 个URL`),
						);
					} catch (error) {
						throw new Error(
							`无法解析输入，请检查文件路径或URL格式`,
						);
					}
				}
			}

			if (urls.length === 0 && !options.file) {
				console.log(chalk.red("❌ 没有找到有效的URL"));
				return;
			}

			// 显示导入选项
			console.log(chalk.cyan("\n⚙️ 导入选项:"));
			console.log(`   下载媒体: ${options.downloadMedia ? "是" : "否"}`);
			if (options.downloadMedia) {
				console.log(
					`   智能媒体下载: ${options.smartMedia ? "是" : "否"}`,
				);
				if (options.smartMedia) {
					console.log(`   └─ 视频笔记只下载视频，图片笔记只下载图片`);
				}
			}
			console.log(
				`   强制重新导入: ${options.forceReimport ? "是" : "否"}`,
			);
			if (options.category) {
				console.log(`   指定分类: ${options.category}`);
			}
			console.log(`   并发数: ${options.parallel}`);

			// 确认开始
			const { confirm } = await inquirer.prompt([
				{
					type: "confirm",
					name: "confirm",
					message: "开始批量导入?",
					default: true,
				},
			]);

			if (!confirm) {
				console.log(chalk.yellow("已取消批量导入"));
				return;
			}

			// 执行批量导入
			const result = await batchImporter.batchImport({
				filePath: options.file,
				urls: urls.length > 0 ? urls : undefined,
				downloadMedia: options.downloadMedia,
				downloadOnlyRelevantMedia: options.smartMedia,
				forceReimport: options.forceReimport,
				category: options.category,
				parallel: parseInt(options.parallel),
			});

			// 显示详细结果
			if (result.successful > 0) {
				console.log(
					chalk.green(`\n✅ 成功导入 ${result.successful} 个笔记`),
				);
			}

			if (result.skipped > 0) {
				console.log(
					chalk.yellow(`\n⏭️ 跳过 ${result.skipped} 个已存在的笔记`),
				);
			}

			if (result.failed > 0) {
				console.log(chalk.red(`\n❌ ${result.failed} 个笔记导入失败`));
			}
		} catch (error) {
			console.error(
				chalk.red("❌ 批量导入错误:"),
				(error as Error).message,
			);
			process.exit(1);
		}
	});

// History command
program
	.command("history")
	.description("Show import history and statistics")
	.option("--export <path>", "Export history to CSV file")
	.option("--clear", "Clear import history")
	.action(async (options) => {
		try {
			const batchImporter = new BatchImporter();
			await batchImporter.initialize();

			if (options.clear) {
				const { confirm } = await inquirer.prompt([
					{
						type: "confirm",
						name: "confirm",
						message: "确定要清空导入历史吗？此操作不可撤销。",
						default: false,
					},
				]);

				if (confirm) {
					await batchImporter.clearImportHistory();
					console.log(chalk.green("✅ 导入历史已清空"));
				}
				return;
			}

			if (options.export) {
				await batchImporter.exportImportHistory(options.export);
				console.log(
					chalk.green(`✅ 导入历史已导出到: ${options.export}`),
				);
				return;
			}

			// 显示统计信息
			const stats = batchImporter.getImportStatistics();

			console.log(chalk.blue("\n📊 导入历史统计"));
			console.log(chalk.cyan("=".repeat(40)));
			console.log(`总导入数量: ${chalk.bold(stats.total)}`);
			console.log(`图片笔记: ${chalk.bold(stats.images)}`);
			console.log(`视频笔记: ${chalk.bold(stats.videos)}`);

			if (Object.keys(stats.byCategory).length > 0) {
				console.log(chalk.cyan("\n📂 分类统计:"));
				Object.entries(stats.byCategory)
					.sort(([, a], [, b]) => b - a)
					.forEach(([category, count]) => {
						const percentage = (
							(count / stats.total) *
							100
						).toFixed(1);
						console.log(
							`   ${category}: ${count} (${percentage}%)`,
						);
					});
			}

			if (stats.recentImports.length > 0) {
				console.log(chalk.cyan("\n⏰ 最近导入:"));
				stats.recentImports.forEach((record, index) => {
					const date = new Date(record.importedAt).toLocaleString();
					const type = record.isVideo ? "视频" : "图片";
					console.log(
						`${index + 1}. ${chalk.bold(record.title)} (${type})`,
					);
					console.log(
						`   📁 ${record.category}/${path.basename(record.filePath)}`,
					);
					console.log(`   🕐 ${date}`);
					if (index < stats.recentImports.length - 1) console.log();
				});
			}
		} catch (error) {
			console.error(
				chalk.red("❌ 历史记录错误:"),
				(error as Error).message,
			);
			process.exit(1);
		}
	});

// Replace-media command
program
	.command("replace-media")
	.description("Replace media URLs in markdown files with S3 URLs")
	.argument("<directory>", "Directory containing markdown files")
	.option("-p, --preview", "Preview only, don't modify files")
	.option("--dry-run", "Simulate replacement without making changes")
	.option("--execute", "Execute the replacement (default is preview)")
	.option("--format <format>", "Output format: text, json", "text")
	.option("--filter <filter>", "Filter: type:image, type:video")
	.option("--backup", "Create backup before modifying")
	.option("--force", "Force re-upload even if already in S3")
	.option("--continue-on-error", "Continue on error")
	.action(async (directory, options) => {
		try {
			const importer = new XHSStandaloneImporter();
			await importer.initialize();

			const s3Config = await importer.getS3Config();

			if (!s3Config.enabled) {
				console.error(chalk.red("❌ S3 未启用，请先配置 S3"));
				console.log(chalk.cyan("运行: xhs-import config --enable-s3"));
				process.exit(1);
			}

			if (!s3Config.endpoint || !s3Config.bucket) {
				console.error(chalk.red("❌ S3 配置不完整，请先配置 endpoint 和 bucket"));
				process.exit(1);
			}

			const config = await importer.getConfig();
			const replacer = new MediaReplacer(s3Config, config);

			const isPreview = options.preview || (!options.dryRun && !options.execute);
			const isDryRun = options.dryRun;
			const isExecute = options.execute;

			if (isPreview) {
				console.log(chalk.blue(`[预览模式] 扫描目录: ${directory}`));
				
				const previewResult = await replacer.preview(directory, options.filter);

				if (previewResult.totalFiles === 0) {
					console.log(chalk.green("✅ 没有找到需要替换的链接"));
					return;
				}

				console.log(chalk.yellow(`\n找到 ${previewResult.totalUrls} 个非S3链接:\n`));

				for (const file of previewResult.files) {
					console.log(chalk.blue(`📄 ${path.basename(file.filePath)} (${file.category})`));
					for (const url of file.urls) {
						const icon = url.type === "image" ? "🖼️" : "🎬";
						console.log(`   ${icon} ${url.url}`);
					}
					console.log();
				}

				console.log(chalk.cyan("─".repeat(50)));
				console.log(`总计: ${previewResult.totalFiles} 个文件, ${previewResult.totalUrls} 个链接需要替换`);
				console.log();
				console.log(chalk.cyan("使用 --dry-run 模拟替换"));
				console.log(chalk.cyan("使用 --execute 正式执行替换"));
			} else if (isDryRun) {
				console.log(chalk.blue(`[模拟替换] 目录: ${directory}`));
				const result = await replacer.execute(directory, {
					backup: options.backup,
					force: options.force,
					continueOnError: options.continueOnError,
					filter: options.filter,
				});

				console.log(chalk.green(`\n✅ 模拟完成`));
				console.log(`   将替换: ${result.results.reduce((sum, r) => sum + r.replaced, 0)} 个链接`);
				console.log(`   将失败: ${result.results.reduce((sum, r) => sum + r.failed.length, 0)} 个链接`);
			} else if (isExecute) {
				const { confirm } = await inquirer.prompt([
					{
						type: "confirm",
						name: "confirm",
						message: "确认执行替换？此操作会修改文件",
						default: false,
					},
				]);

				if (!confirm) {
					console.log(chalk.yellow("已取消"));
					return;
				}

				console.log(chalk.blue(`[执行替换] 目录: ${directory}`));
				
				const result = await replacer.execute(directory, {
					backup: options.backup,
					force: options.force,
					continueOnError: options.continueOnError,
					filter: options.filter,
				});

				console.log(chalk.green(`\n✅ 替换完成`));
				console.log(`   成功: ${result.success} 个文件`);
				console.log(`   失败: ${result.failed} 个文件`);
				console.log(`   跳过: ${result.skipped} 个链接`);
				console.log(`   总替换: ${result.results.reduce((sum, r) => sum + r.replaced, 0)} 个链接`);

				if (options.backup) {
					console.log(chalk.cyan(`   备份目录: ${directory}/.backup`));
				}
			}
		} catch (error) {
			console.error(chalk.red("❌ 错误:"), (error as Error).message);
			process.exit(1);
		}
	});

// Cleanup-media command
async function findMarkdownFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory() && entry.name !== "media" && !entry.name.startsWith(".")) {
			files.push(...await findMarkdownFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(fullPath);
		}
	}
	
	return files;
}

function extractMediaUrlsFromContent(content: string): string[] {
	const urls: string[] = [];
	
	const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	let match;
	while ((match = imageRegex.exec(content)) !== null) {
		urls.push(match[2]);
	}
	
	const videoRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>/gi;
	while ((match = videoRegex.exec(content)) !== null) {
		urls.push(match[1]);
	}
	
	const coverRegex = /^cover:\s*(.+)$/m;
	while ((match = coverRegex.exec(content)) !== null) {
		urls.push(match[1].trim());
	}
	
	return urls;
}

program
	.command("cleanup-media")
	.description("Clean up orphaned media files")
	.argument("<directory>", "Directory containing markdown and media files")
	.option("-p, --preview", "Preview files to be deleted")
	.option("--execute", "Execute the cleanup")
	.option("--dry-run", "Simulate cleanup without making changes")
	.action(async (directory, options) => {
		try {
			const importer = new XHSStandaloneImporter();
			await importer.initialize();
			const config = await importer.getConfig();

			const fullPath = path.resolve(directory);
			const mediaPath = path.join(fullPath, "media");

			const isPreview = options.preview || (!options.execute);
			const isDryRun = options.dryRun;
			const isExecute = options.execute;

			const markdownFiles = await findMarkdownFiles(fullPath);
			const referencedMedia = new Set<string>();
			
			for (const mdFile of markdownFiles) {
				const content = await fs.readFile(mdFile, "utf-8");
				const urls = extractMediaUrlsFromContent(content);
				
				for (const url of urls) {
					const filename = path.basename(url);
					referencedMedia.add(filename);
				}
			}

			let mediaFiles: string[] = [];
			try {
				const entries = await fs.readdir(mediaPath, { withFileTypes: true });
				mediaFiles = entries
					.filter(e => e.isFile())
					.map(e => e.name);
			} catch (error) {
				console.log(chalk.yellow("⚠️ 没有找到 media 目录"));
				mediaFiles = [];
			}

			const orphanedFiles = mediaFiles.filter(f => !referencedMedia.has(f));

			if (isPreview || isDryRun) {
				console.log(chalk.blue(`[预览模式] 目录: ${fullPath}`));
				console.log();
				console.log(`📊 统计信息:`);
				console.log(`   Markdown 文件: ${markdownFiles.length}`);
				console.log(`   媒体文件总数: ${mediaFiles.length}`);
				console.log(`   引用的媒体: ${referencedMedia.size}`);
				console.log(`   孤立媒体: ${orphanedFiles.length}`);
				console.log();

				if (orphanedFiles.length > 0) {
					console.log(chalk.yellow(`🗑️ 孤立文件 (将被删除):`));
					for (const file of orphanedFiles) {
						console.log(`   - ${file}`);
					}
					console.log();
					console.log(chalk.cyan("使用 --execute 执行删除"));
				} else {
					console.log(chalk.green("✅ 没有孤立的媒体文件"));
				}
			} else if (isExecute) {
				const { confirm } = await inquirer.prompt([
					{
						type: "confirm",
						name: "confirm",
						message: `确认删除 ${orphanedFiles.length} 个孤立媒体文件？`,
						default: false,
					},
				]);

				if (!confirm) {
					console.log(chalk.yellow("已取消"));
					return;
				}

				let deleted = 0;
				for (const file of orphanedFiles) {
					const filePath = path.join(mediaPath, file);
					await fs.unlink(filePath);
					deleted++;
				}

				console.log(chalk.green(`\n✅ 已删除 ${deleted} 个孤立媒体文件`));
			}
		} catch (error) {
			console.error(chalk.red("❌ 错误:"), (error as Error).message);
			process.exit(1);
		}
	});

program.parse();
