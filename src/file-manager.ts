import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { XHSNote, ImportResult, S3Config } from "./types";
import { S3Uploader } from "./s3-uploader";

export class FileManager {
	private baseFolder: string;
	private basePath: string;
	private createMediaFolder: boolean;
	private s3Config?: S3Config;
	private s3Uploader?: S3Uploader;

	constructor(
		baseFolder: string,
		createMediaFolder: boolean = true,
		basePath?: string,
		s3Config?: S3Config,
	) {
		this.baseFolder = baseFolder;
		this.basePath = basePath || process.cwd();
		this.createMediaFolder = createMediaFolder;
		this.s3Config = s3Config;
		
		if (s3Config?.enabled) {
			this.s3Uploader = new S3Uploader(s3Config);
		}
	}

	// 获取完整的基础目录路径
	getBasePath(): string {
		return this.basePath;
	}

	// 获取完整的XHS Notes目录路径
	getFullBasePath(): string {
		return path.join(this.basePath, this.baseFolder);
	}

	async createNote(
		note: XHSNote,
		category: string,
		downloadMedia: boolean = false,
		uploadToS3: boolean = false,
	): Promise<ImportResult> {
		try {
			const fullBasePath = this.getFullBasePath();
			const categoryFolder = path.join(fullBasePath, category);
			const mediaFolder = path.join(fullBasePath, "media");

			await this.ensureDirectory(categoryFolder);

			if (downloadMedia && this.createMediaFolder) {
				await this.ensureDirectory(mediaFolder);
			}

			const safeTitle = this.sanitizeTitle(note.title);
			const prefix = note.isVideo ? "[V]" : "";
			const filename = `${prefix}${safeTitle}.md`;
			const filePath = path.join(categoryFolder, filename);

			const useS3Urls = !!(uploadToS3 && this.s3Uploader);
			const mediaFiles: string[] = [];
			const mediaUrls: string[] = [];
			const s3UrlMap: Record<string, string> = {};
			const hashMap: Record<string, string> = {};

			if (downloadMedia) {
				if (note.isVideo) {
					for (let i = 0; i < note.videos.length; i++) {
						const filename = `${this.sanitizeTitle(note.title)}-${this.getShortId(note.id)}-video-${i}.mp4`;
						const result = await this.downloadMediaFile(
							note.videos[i],
							mediaFolder,
							filename,
							uploadToS3,
						);
						if (result.success) {
							if (result.localPath) mediaFiles.push(result.localPath);
							if (result.s3Url) {
								mediaUrls.push(result.s3Url);
								if (result.hash) {
									s3UrlMap[result.hash] = result.s3Url;
									hashMap[`video_${i}`] = result.hash;
								}
							}
						}
					}
					for (let i = 0; i < note.images.length; i++) {
						const filename = `${this.sanitizeTitle(note.title)}-${this.getShortId(note.id)}-${i}.jpg`;
						const result = await this.downloadMediaFile(
							note.images[i],
							mediaFolder,
							filename,
							uploadToS3,
						);
						if (result.success) {
							if (result.localPath) mediaFiles.push(result.localPath);
							if (result.s3Url) {
								mediaUrls.push(result.s3Url);
								if (result.hash) {
									s3UrlMap[result.hash] = result.s3Url;
									hashMap[`image_${i}`] = result.hash;
								}
							}
						}
					}
				} else {
					for (let i = 0; i < note.images.length; i++) {
						const filename = `${this.sanitizeTitle(note.title)}-${this.getShortId(note.id)}-${i}.jpg`;
						const result = await this.downloadMediaFile(
							note.images[i],
							mediaFolder,
							filename,
							uploadToS3,
						);
						if (result.success) {
							if (result.localPath) mediaFiles.push(result.localPath);
							if (result.s3Url) {
								mediaUrls.push(result.s3Url);
								if (result.hash) {
									s3UrlMap[result.hash] = result.s3Url;
									hashMap[`image_${i}`] = result.hash;
								}
							}
						}
					}
				}
			}

			const markdown = this.generateMarkdown(
				note,
				downloadMedia,
				mediaFolder,
				useS3Urls,
				s3UrlMap,
				hashMap,
			);

			await fs.writeFile(filePath, markdown, "utf-8");

			return {
				filePath,
				category,
				mediaFiles,
				mediaUrls,
				success: true,
			};
		} catch (error) {
			return {
				filePath: "",
				category,
				mediaFiles: [],
				success: false,
				error: (error as Error).message,
			};
		}
	}

	private async ensureDirectory(dirPath: string): Promise<void> {
		try {
			await fs.access(dirPath);
		} catch {
			await fs.mkdir(dirPath, { recursive: true });
		}
	}

	private sanitizeTitle(title: string): string {
		let sanitized = title.replace(/[<>:"/\\|?*()""''（）#]/g, "-");
		sanitized = sanitized.replace(/\s+/g, "-");
		sanitized = sanitized.replace(/-+/g, "-");
		sanitized = sanitized.replace(/^-+|-+$/g, "");
		return sanitized.length > 0 ? sanitized.substring(0, 50) : "Untitled";
	}

	private getShortId(id: string): string {
		return id ? id.substring(0, 6) : "unknown";
	}

	generateHashedFilename(buffer: Buffer, ext: string): string {
		const hash = crypto.createHash("md5").update(buffer).digest("hex");
		return `${hash}${ext}`;
	}

	private generateMarkdown(
		note: XHSNote,
		downloadMedia: boolean,
		mediaFolder: string,
		useS3Urls: boolean = false,
		s3UrlMap: Record<string, string> = {},
		hashMap: Record<string, string> = {},
	): string {
		const now = new Date();
		const dateStr = now.toISOString().split("T")[0];
		const importedAt = now.toLocaleString();

		const getImageUrl = (index: number, isVideo: boolean = false): string => {
			const hashKey = isVideo ? `video_${index}` : `image_${index}`;
			const hashFilename = hashMap[hashKey];
			const filename = hashFilename || (isVideo
				? `${this.sanitizeTitle(note.title)}-${this.getShortId(note.id)}-video-${index}.mp4`
				: `${this.sanitizeTitle(note.title)}-${this.getShortId(note.id)}-${index}.jpg`);
			
			if (useS3Urls && hashFilename && s3UrlMap[hashFilename]) {
				return s3UrlMap[hashFilename];
			}
			return downloadMedia ? `../media/${filename}` : note.images[index];
		};

		let coverImageUrl = "";
		if (note.images.length > 0) {
			coverImageUrl = note.images[0];
			if (downloadMedia) {
				coverImageUrl = getImageUrl(0);
			}
		}

		const cleanTags = note.tags.map((tag) => tag.replace(/#$/, ""));

		let frontmatter = `---
title: ${note.title}
source: ${note.url}
date: ${dateStr}
Imported At: ${importedAt}
category: ${note.category || "Uncategorized"}
type: ${note.isVideo ? "video" : "image"}`;

		if (coverImageUrl) {
			frontmatter += `\ncover: ${coverImageUrl}`;
		}

		if (cleanTags.length > 0) {
			frontmatter += `\ntags: [${cleanTags.map((tag) => `"${tag}"`).join(", ")}]`;
		}

		frontmatter += "\n---\n\n";

		let markdown = frontmatter;

		markdown += `# ${note.title}\n\n`;

		const cleanContent = note.content.replace(/#\S+/g, "").trim();
		markdown += `${cleanContent}\n\n`;

		if (!note.isVideo && note.images.length > 0) {
			let coverUrl = note.images[0];
			if (downloadMedia) {
				coverUrl = getImageUrl(0);
			}
			markdown += `![${note.title}](${coverUrl})\n\n`;

			if (note.images.length > 1) {
				const imageMarkdown = note.images
					.slice(1)
					.map((url, index) => {
						const finalUrl = downloadMedia ? getImageUrl(index + 1) : url;
						return `![Image ${index + 1}](${finalUrl})`;
					})
					.join("\n");

				if (imageMarkdown) {
					markdown += `${imageMarkdown}\n\n`;
				}
			}
		}

		if (note.isVideo && note.videos.length > 0) {
			const videoHashKey = 'video_0';
			const videoHash = hashMap[videoHashKey] || `${this.sanitizeTitle(note.title)}-${this.getShortId(note.id)}-video-0.mp4`;
			let videoUrl = note.videos[0];
			if (downloadMedia) {
				if (useS3Urls && hashMap[videoHashKey] && s3UrlMap[hashMap[videoHashKey]]) {
					videoUrl = s3UrlMap[hashMap[videoHashKey]];
				} else {
					videoUrl = `../media/${videoHash}`;
				}
			}
			markdown += `<video controls src="${videoUrl}" width="100%"></video>\n\n`;
		}

		return markdown;
	}

	private async downloadMediaFile(
		url: string,
		folder: string,
		filename: string,
		uploadToS3: boolean = false,
	): Promise<{ success: boolean; localPath?: string; s3Url?: string; hash?: string; error?: string }> {
		try {
			const fetch = (await import("node-fetch")).default;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}`);
			}

			const buffer = await response.buffer();
			const ext = filename.split(".").pop() || "jpg";
			const hash = this.generateHashedFilename(buffer, `.${ext}`);
			const localPath = path.join(folder, hash);
			await fs.writeFile(localPath, buffer);

			let s3Url: string | undefined;
			if (uploadToS3 && this.s3Uploader) {
				const contentType = ext === "mp4" ? "video/mp4" : `image/${ext === "jpg" ? "jpeg" : ext}`;
				const result = await this.s3Uploader.uploadBuffer(buffer, hash, contentType);
				if (result.success && result.url) {
					s3Url = result.url;
				}
			}

			return {
				success: true,
				localPath: localPath,
				s3Url,
				hash,
			};
		} catch (error) {
			console.error(`Failed to download media from ${url}:`, error);
			return {
				success: false,
				error: (error as Error).message,
			};
		}
	}

	async createFolderStructure(baseFolder: string): Promise<void> {
		await this.ensureDirectory(baseFolder);
	}
}
