import { XHSImporter } from "./xhs-importer";
import { AIClassifier } from "./ai-classifier";
import { FileManager } from "./file-manager";
import { ConfigManager } from "./config";
import { BatchImporter } from "./batch-importer";
import { S3Uploader } from "./s3-uploader";
import { XHSNote, ImportResult, Config } from "./types";

export class XHSStandaloneImporter {
	private xhsImporter: XHSImporter;
	private configManager: ConfigManager;
	private fileManager!: FileManager;
	private aiClassifier?: AIClassifier;
	private s3Uploader?: S3Uploader;

	constructor(configDir?: string) {
		this.xhsImporter = new XHSImporter();
		this.configManager = new ConfigManager(configDir);
	}

	async initialize(): Promise<void> {
		const config = await this.configManager.loadConfig();
		this.fileManager = new FileManager(
			config.baseFolder,
			config.output.createMediaFolder,
			undefined,
			config.s3.enabled ? config.s3 : undefined,
		);

		if (config.s3.enabled && config.s3.endpoint && config.s3.bucket) {
			this.s3Uploader = new S3Uploader(config.s3);
		}

		if (config.ai.enabled && config.ai.apiKey) {
			this.aiClassifier = new AIClassifier(config.ai);
		}

		await this.fileManager.createFolderStructure(config.baseFolder);
	}

	async importFromShareText(
		shareText: string,
		options: {
			downloadMedia?: boolean;
			forceCategory?: string;
			uploadToS3?: boolean;
		} = {},
	): Promise<ImportResult> {
		const config = await this.configManager.loadConfig();

		const url = this.xhsImporter.extractURL(shareText);
		if (!url) {
			throw new Error("No valid Xiaohongshu URL found in the text");
		}

		const note = await this.xhsImporter.importXHSNote(url);

		let category = options.forceCategory;
		if (!category) {
			if (this.aiClassifier && config.ai.enabled) {
				console.log("AI is categorizing the note...");
				category = await this.aiClassifier.categorizeNote(
					note,
					config.categories,
				);
			} else {
				category = AIClassifier.keywordBasedCategorize(
					note,
					config.categories,
				);
			}
		}

		note.category = category;

		const downloadMedia = options.downloadMedia ?? config.downloadMedia;
		const uploadToS3 = options.uploadToS3 ?? (config.s3.enabled && config.s3.uploadStrategy !== "local-only");
		
		return await this.fileManager.createNote(note, category, downloadMedia, uploadToS3);
	}

	async importFromUrl(
		url: string,
		options: {
			downloadMedia?: boolean;
			forceCategory?: string;
			uploadToS3?: boolean;
		} = {},
	): Promise<ImportResult> {
		const note = await this.xhsImporter.importXHSNote(url);

		const config = await this.configManager.loadConfig();

		let category = options.forceCategory;
		if (!category) {
			if (this.aiClassifier && config.ai.enabled) {
				console.log("AI is categorizing the note...");
				category = await this.aiClassifier.categorizeNote(
					note,
					config.categories,
				);
			} else {
				category = AIClassifier.keywordBasedCategorize(
					note,
					config.categories,
				);
			}
		}

		note.category = category;

		const downloadMedia = options.downloadMedia ?? config.downloadMedia;
		const uploadToS3 = options.uploadToS3 ?? (config.s3.enabled && config.s3.uploadStrategy !== "local-only");
		
		return await this.fileManager.createNote(note, category, downloadMedia, uploadToS3);
	}

	async updateConfig(updates: any): Promise<void> {
		await this.configManager.updateConfig(updates);

		// Reinitialize AI classifier if AI settings changed
		if (updates.ai) {
			const config = await this.configManager.loadConfig();
			if (config.ai.enabled && config.ai.apiKey) {
				this.aiClassifier = new AIClassifier(config.ai);
			} else {
				this.aiClassifier = undefined;
			}
		}
	}

	async getConfig() {
		return await this.configManager.loadConfig();
	}

	// Get available categories
	async getCategories(): Promise<string[]> {
		const config = await this.configManager.loadConfig();
		return [...config.categories, "其他"];
	}

	// Get S3Uploader instance
	getS3Uploader(): S3Uploader | undefined {
		return this.s3Uploader;
	}

	// Get S3 config
	async getS3Config() {
		const config = await this.configManager.loadConfig();
		return config.s3;
	}

	// Update S3 config
	async updateS3Config(updates: Partial<Config["s3"]>): Promise<void> {
		const config = await this.configManager.loadConfig();
		const newS3Config = { ...config.s3, ...updates };
		await this.configManager.updateConfig({ s3: newS3Config });
		
		if (newS3Config.enabled && newS3Config.endpoint && newS3Config.bucket) {
			this.s3Uploader = new S3Uploader(newS3Config);
		} else {
			this.s3Uploader = undefined;
		}
	}
}

// Export BatchImporter for external use
export { BatchImporter } from "./batch-importer";
export { ImportHistory } from "./import-history";
export { AntiBotProtection } from "./anti-bot";
export { S3Uploader } from "./s3-uploader";
