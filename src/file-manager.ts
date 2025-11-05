import fs from "fs/promises";
import path from "path";
import { XHSNote, ImportResult } from "./types";

export class FileManager {
	private baseFolder: string;
	private basePath: string; // 完整的基础路径
	private createMediaFolder: boolean;

	constructor(
		baseFolder: string,
		createMediaFolder: boolean = true,
		basePath?: string,
	) {
		this.baseFolder = baseFolder;
		this.basePath = basePath || process.cwd(); // 如果没有指定basePath，使用当前工作目录
		this.createMediaFolder = createMediaFolder;
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
	): Promise<ImportResult> {
		try {
			// Create folders if they don't exist
			const fullBasePath = this.getFullBasePath();
			const categoryFolder = path.join(fullBasePath, category);
			const mediaFolder = path.join(fullBasePath, "media");

			await this.ensureDirectory(categoryFolder);

			if (downloadMedia && this.createMediaFolder) {
				await this.ensureDirectory(mediaFolder);
			}

			// Generate filename
			const safeTitle = this.sanitizeTitle(note.title);
			const prefix = note.isVideo ? "[V]" : "";
			const filename = `${prefix}${safeTitle}.md`;
			const filePath = path.join(categoryFolder, filename);

			// Generate markdown content
			const markdown = this.generateMarkdown(
				note,
				downloadMedia,
				mediaFolder,
			);

			// Download media files if needed
			const mediaFiles: string[] = [];
			if (downloadMedia) {
				if (note.isVideo) {
					// 视频笔记：下载视频文件 + 下载封面图片（如果有）
					// 下载视频文件
					for (let i = 0; i < note.videos.length; i++) {
						const mediaFile = await this.downloadMediaFile(
							note.videos[i],
							mediaFolder,
							`${this.sanitizeTitle(note.title)}-video-${i}.mp4`,
						);
						if (mediaFile) {
							mediaFiles.push(mediaFile);
						}
					}
					// 下载封面图片（如果有图片）
					for (let i = 0; i < note.images.length; i++) {
						const mediaFile = await this.downloadMediaFile(
							note.images[i],
							mediaFolder,
							`${this.sanitizeTitle(note.title)}-${i}.jpg`,
						);
						if (mediaFile) {
							mediaFiles.push(mediaFile);
						}
					}
				} else {
					// 图片笔记：下载所有图片文件
					for (let i = 0; i < note.images.length; i++) {
						const mediaFile = await this.downloadMediaFile(
							note.images[i],
							mediaFolder,
							`${this.sanitizeTitle(note.title)}-${i}.jpg`,
						);
						if (mediaFile) {
							mediaFiles.push(mediaFile);
						}
					}
				}
			}

			// Write markdown file
			await fs.writeFile(filePath, markdown, "utf-8");

			return {
				filePath,
				category,
				mediaFiles,
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
		// Remove invalid characters for filenames
		let sanitized = title.replace(/[<>:"/\\|?*]/g, "-");
		sanitized = sanitized.replace(/\s+/g, "-");
		sanitized = sanitized.replace(/-+/g, "-");
		sanitized = sanitized.replace(/^-+|-+$/g, "");
		return sanitized.length > 0 ? sanitized.substring(0, 50) : "Untitled";
	}

	private generateMarkdown(
		note: XHSNote,
		downloadMedia: boolean,
		mediaFolder: string,
	): string {
		const now = new Date();
		const dateStr = now.toISOString().split("T")[0];
		const importedAt = now.toLocaleString();

		// Determine cover image URL - ALWAYS use images for cover, never video files
		let coverImageUrl = "";
		if (note.images.length > 0) {
			// Both video and image notes: use first image as cover if available
			coverImageUrl = note.images[0];
			if (downloadMedia) {
				const imageFilename = `${this.sanitizeTitle(note.title)}-0.jpg`;
				coverImageUrl = `../media/${imageFilename}`;
			}
		}
		// For any notes without images, no cover image will be set

		// Clean tags (remove trailing #)
		const cleanTags = note.tags.map((tag) => tag.replace(/#$/, ""));

		// Build frontmatter with cover image and tags
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

		// Add title
		markdown += `# ${note.title}\n\n`;

		// Handle video notes - add video player after content
		if (note.isVideo && note.videos.length > 0) {
			let videoUrl = note.videos[0];
			if (downloadMedia) {
				const videoFilename = `${this.sanitizeTitle(note.title)}-video-0.mp4`;
				videoUrl = `../media/${videoFilename}`;
			}
			// Note: video will be added after content, not at the top
		}

		// Add content (remove tags from content)
		const cleanContent = note.content.replace(/#\S+/g, "").trim();
		markdown += `${cleanContent}\n\n`;

		// Handle image notes - show cover image in content
		if (!note.isVideo && note.images.length > 0) {
			// Add cover image back to content for image notes
			let coverImageUrl = note.images[0];
			if (downloadMedia) {
				const imageFilename = `${this.sanitizeTitle(note.title)}-0.jpg`;
				coverImageUrl = `../media/${imageFilename}`;
			}
			markdown += `![${note.title}](${coverImageUrl})\n\n`;

			// Add remaining images (excluding cover image)
			if (note.images.length > 1) {
				const imageMarkdown = note.images
					.slice(1) // Skip first image (already added as cover)
					.map((url, index) => {
						let finalUrl = url;
						if (downloadMedia) {
							const imageFilename = `${this.sanitizeTitle(note.title)}-${index + 1}.jpg`;
							finalUrl = `../media/${imageFilename}`;
						}
						return `![Image ${index + 1}](${finalUrl})`;
					})
					.join("\n");

				if (imageMarkdown) {
					markdown += `${imageMarkdown}\n\n`;
				}
			}
		}

		// Handle video notes - add video player after content
		if (note.isVideo && note.videos.length > 0) {
			let videoUrl = note.videos[0];
			if (downloadMedia) {
				const videoFilename = `${this.sanitizeTitle(note.title)}-video-0.mp4`;
				videoUrl = `../media/${videoFilename}`;
			}
			markdown += `<video controls src="${videoUrl}" width="100%"></video>\n\n`;
		}

		// Tags are now only displayed in frontmatter

		return markdown;
	}

	private async downloadMediaFile(
		url: string,
		folder: string,
		filename: string,
	): Promise<string | null> {
		try {
			const fetch = (await import("node-fetch")).default;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}`);
			}

			const buffer = await response.buffer();
			const filePath = path.join(folder, filename);
			await fs.writeFile(filePath, buffer);

			return filename;
		} catch (error) {
			console.error(`Failed to download media from ${url}:`, error);
			return null;
		}
	}

	async createFolderStructure(baseFolder: string): Promise<void> {
		await this.ensureDirectory(baseFolder);
	}
}
