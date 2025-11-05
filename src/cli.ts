#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { XHSStandaloneImporter } from "./index";
import { BatchImporter } from "./batch-importer";
import { Config } from "./types";
import path from "path";

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
	.action(async (options) => {
		try {
			const importer = new XHSStandaloneImporter();
			await importer.initialize();

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
				const result = await importer.importFromShareText(shareText, {
					downloadMedia: options.downloadMedia,
					forceCategory: options.category,
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
	.option("--set-ai-key <key>", "Set AI API key")
	.option(
		"--set-ai-provider <provider>",
		"Set AI provider (openai/anthropic/deepseek)",
	)
	.option("--set-base-folder <folder>", "Set base folder for imports")
	.option("--enable-ai", "Enable AI categorization")
	.option("--disable-ai", "Disable AI categorization")
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

program.parse();
