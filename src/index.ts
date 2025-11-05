import { XHSImporter } from "./xhs-importer";
import { AIClassifier } from "./ai-classifier";
import { FileManager } from "./file-manager";
import { ConfigManager } from "./config";
import { BatchImporter } from "./batch-importer";
import { XHSNote, ImportResult } from "./types";

export class XHSStandaloneImporter {
	private xhsImporter: XHSImporter;
	private configManager: ConfigManager;
	private fileManager!: FileManager;
	private aiClassifier?: AIClassifier;

	constructor(configDir?: string) {
		this.xhsImporter = new XHSImporter();
		this.configManager = new ConfigManager(configDir);
	}

	async initialize(): Promise<void> {
		const config = await this.configManager.loadConfig();
		this.fileManager = new FileManager(
			config.baseFolder,
			config.output.createMediaFolder,
		);

		if (config.ai.enabled && config.ai.apiKey) {
			this.aiClassifier = new AIClassifier(config.ai);
		}

		// Create base folder structure
		await this.fileManager.createFolderStructure(config.baseFolder);
	}

	async importFromShareText(
		shareText: string,
		options: {
			downloadMedia?: boolean;
			forceCategory?: string;
		} = {},
	): Promise<ImportResult> {
		const config = await this.configManager.loadConfig();

		// Extract URL from share text
		const url = this.xhsImporter.extractURL(shareText);
		if (!url) {
			throw new Error("No valid Xiaohongshu URL found in the text");
		}

		// Import note data
		const note = await this.xhsImporter.importXHSNote(url);

		// Determine category
		let category = options.forceCategory;
		if (!category) {
			if (this.aiClassifier && config.ai.enabled) {
				console.log("AI is categorizing the note...");
				category = await this.aiClassifier.categorizeNote(
					note,
					config.categories,
				);
			} else {
				// Fallback to keyword-based categorization
				category = AIClassifier.keywordBasedCategorize(
					note,
					config.categories,
				);
			}
		}

		// Set the determined category
		note.category = category;

		// Create markdown file
		const downloadMedia = options.downloadMedia ?? config.downloadMedia;
		return await this.fileManager.createNote(note, category, downloadMedia);
	}

	async importFromUrl(
		url: string,
		options: {
			downloadMedia?: boolean;
			forceCategory?: string;
		} = {},
	): Promise<ImportResult> {
		// Import note data
		const note = await this.xhsImporter.importXHSNote(url);

		const config = await this.configManager.loadConfig();

		// Determine category
		let category = options.forceCategory;
		if (!category) {
			if (this.aiClassifier && config.ai.enabled) {
				console.log("AI is categorizing the note...");
				category = await this.aiClassifier.categorizeNote(
					note,
					config.categories,
				);
			} else {
				// Fallback to keyword-based categorization
				category = AIClassifier.keywordBasedCategorize(
					note,
					config.categories,
				);
			}
		}

		// Set the determined category
		note.category = category;

		// Create markdown file
		const downloadMedia = options.downloadMedia ?? config.downloadMedia;
		return await this.fileManager.createNote(note, category, downloadMedia);
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
}

// Export BatchImporter for external use
export { BatchImporter } from "./batch-importer";
export { ImportHistory } from "./import-history";
export { AntiBotProtection } from "./anti-bot";
