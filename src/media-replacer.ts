import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { S3Config, MediaInfo, ReplaceResult, Config } from "./types";
import { S3Uploader } from "./s3-uploader";

export interface PreviewResult {
	totalFiles: number;
	totalUrls: number;
	files: {
		filePath: string;
		category: string;
		urls: MediaInfo[];
	}[];
}

export interface BatchReplaceResult {
	total: number;
	success: number;
	failed: number;
	skipped: number;
	results: ReplaceResult[];
}

interface ReplaceOptions {
	backup?: boolean;
	force?: boolean;
	continueOnError?: boolean;
	filter?: string;
}

export class MediaReplacer {
	private s3Config: S3Config;
	private config: Config;
	private uploader: S3Uploader;

	constructor(s3Config: S3Config, config: Config) {
		this.s3Config = s3Config;
		this.config = config;
		this.uploader = new S3Uploader(s3Config);
	}

	async preview(directory: string, filter?: string): Promise<PreviewResult> {
		const files = await this.scanMarkdownFiles(directory);
		const result: PreviewResult = {
			totalFiles: 0,
			totalUrls: 0,
			files: [],
		};

		for (const filePath of files) {
			const category = this.extractCategoryFromPath(filePath, directory);
			const urls = await this.extractNonS3Urls(filePath, filter);
			
			if (urls.length > 0) {
				result.totalFiles++;
				result.totalUrls += urls.length;
				result.files.push({
					filePath,
					category,
					urls,
				});
			}
		}

		return result;
	}

	async execute(
		directory: string,
		options: ReplaceOptions = {},
	): Promise<BatchReplaceResult> {
		const files = await this.scanMarkdownFiles(directory);
		const backupDir = options.backup
			? path.join(directory, ".backup")
			: null;

		if (backupDir) {
			await fs.mkdir(backupDir, { recursive: true });
		}

		const result: BatchReplaceResult = {
			total: files.length,
			success: 0,
			failed: 0,
			skipped: 0,
			results: [],
		};

		for (const filePath of files) {
			const replaceResult = await this.processFile(
				filePath,
				directory,
				options,
				backupDir,
			);

			result.results.push(replaceResult);

			if (replaceResult.success) {
				result.success++;
			} else {
				result.failed++;
			}

			result.skipped += replaceResult.skipped.length;

			if (!replaceResult.success && !options.continueOnError && result.failed > 0) {
				break;
			}
		}

		return result;
	}

	private async processFile(
		filePath: string,
		directory: string,
		options: ReplaceOptions,
		backupDir: string | null,
	): Promise<ReplaceResult> {
		try {
			let content = await fs.readFile(filePath, "utf-8");
			const originalContent = content;

			if (backupDir) {
				const relativePath = path.relative(directory, filePath);
				const backupPath = path.join(backupDir, relativePath);
				await fs.mkdir(path.dirname(backupPath), { recursive: true });
				await fs.writeFile(backupPath, originalContent, "utf-8");
			}

			const urls = this.extractMediaUrls(content);
			const nonS3Urls = urls.filter((url) => !this.isS3Url(url.url));

			let replaced = 0;
			const failed: MediaInfo[] = [];
			const skipped: number[] = [];

			for (let i = 0; i < nonS3Urls.length; i++) {
				const mediaInfo = nonS3Urls[i];
				
				if (options.filter) {
					const filterMatch = this.matchFilter(options.filter, mediaInfo);
					if (!filterMatch) {
						skipped.push(i);
						continue;
					}
				}

				try {
					const uploadResult = await this.uploadToS3WithRetry(
						mediaInfo.originalUrl,
						options.force,
					);

					if (uploadResult.success && uploadResult.url) {
						content = content.replace(mediaInfo.originalUrl, uploadResult.url);
						replaced++;
					} else {
						failed.push(mediaInfo);
						content += `\n\n<!-- TODO: Failed to upload ${mediaInfo.originalUrl}: ${uploadResult.error} -->\n`;
					}
				} catch (error) {
					failed.push(mediaInfo);
				}
			}

			if (replaced > 0 || failed.length > 0) {
				await fs.writeFile(filePath, content, "utf-8");
			}

			return {
				filePath,
				success: failed.length === 0,
				replaced,
				failed,
				skipped,
			};
		} catch (error) {
			return {
				filePath,
				success: false,
				replaced: 0,
				failed: [],
				skipped: [],
			};
		}
	}

	private async uploadToS3WithRetry(
		url: string,
		force: boolean = false,
	): Promise<{ success: boolean; url?: string; error?: string }> {
		const maxRetries = this.s3Config.retry.maxRetries;
		let lastError: string = "";

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const result = await this.uploader.uploadFromUrl(url);
			
			if (result.success) {
				return result;
			}

			lastError = result.error || "Unknown error";
			
			if (attempt < maxRetries - 1) {
				await this.sleep(1000 * (attempt + 1));
			}
		}

		return {
			success: false,
			error: lastError,
		};
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async scanMarkdownFiles(directory: string): Promise<string[]> {
		const files: string[] = [];
		await this.scanDir(directory, files);
		return files;
	}

	private async scanDir(directory: string, files: string[]): Promise<void> {
		const entries = await fs.readdir(directory, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(directory, entry.name);

			if (entry.isDirectory() && entry.name !== ".backup") {
				await this.scanDir(fullPath, files);
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				files.push(fullPath);
			}
		}
	}

	extractMediaUrls(content: string): MediaInfo[] {
		const urls: MediaInfo[] = [];

		const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
		let match;
		while ((match = imageRegex.exec(content)) !== null) {
			urls.push({
				type: "image",
				url: match[2],
				originalUrl: match[2],
			});
		}

		const videoRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>/gi;
		while ((match = videoRegex.exec(content)) !== null) {
			urls.push({
				type: "video",
				url: match[1],
				originalUrl: match[1],
			});
		}

		const coverRegex = /^cover:\s*(.+)$/m;
		const coverMatch = coverRegex.exec(content);
		if (coverMatch) {
			const coverUrl = coverMatch[1].trim();
			if (!coverUrl.startsWith("../") && !coverUrl.startsWith("s3://")) {
				urls.push({
					type: "image",
					url: coverUrl,
					originalUrl: coverUrl,
				});
			}
		}

		return urls;
	}

	async extractNonS3Urls(filePath: string, filter?: string): Promise<MediaInfo[]> {
		try {
			const content = await fs.readFile(filePath, "utf-8");
			const urls = this.extractMediaUrls(content);

			return urls.filter((url) => {
				if (this.isS3Url(url.url)) {
					return false;
				}
				if (url.url.startsWith("../") || url.url.startsWith("s3://")) {
					return false;
				}
				if (filter) {
					return this.matchFilter(filter, url);
				}
				return true;
			});
		} catch {
			return [];
		}
	}

	private isS3Url(url: string): boolean {
		if (url.startsWith("s3://")) {
			return true;
		}

		const cleanEndpoint = this.s3Config.endpoint.replace(/\/$/, "");
		const cleanBucket = this.s3Config.bucket;

		return (
			url.includes(`${cleanBucket}/`) ||
			url.includes(cleanEndpoint) ||
			url.startsWith(cleanEndpoint)
		);
	}

	private matchFilter(filter: string, mediaInfo: MediaInfo): boolean {
		const [type, value] = filter.split(":");

		if (type === "type") {
			return mediaInfo.type === value;
		}

		if (type === "category") {
			return false;
		}

		return true;
	}

	private extractCategoryFromPath(filePath: string, baseDir: string): string {
		const relativePath = path.relative(baseDir, filePath);
		const parts = relativePath.split(path.sep);
		
		if (parts.length >= 2 && parts[1] !== "media") {
			return parts[0];
		}
		
		return "Unknown";
	}
}
