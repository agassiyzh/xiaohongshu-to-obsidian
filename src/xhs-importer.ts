import fetch from "node-fetch";
import { XHSNote } from "./types";
import { AntiBotProtection } from "./anti-bot";

export class XHSImporter {
	private antiBot: AntiBotProtection;

	constructor(antiBotConfig?: any) {
		this.antiBot = new AntiBotProtection(antiBotConfig);
	}

	/**
	 * Extract Xiaohongshu URL from share text
	 */
	extractURL(shareText: string): string | null {
		const urlMatch = shareText.match(
			/(http:\/\/xhslink\.com\/a?o?\/[^\s,，]+)|(https:\/\/www\.xiaohongshu\.com\/explore\/[^\s,，]+)/,
		);
		return urlMatch ? urlMatch[0] : null;
	}

	/**
	 * Fetch and parse Xiaohongshu note data
	 */
	async importXHSNote(
		url: string,
		requestIndex: number = 0,
	): Promise<XHSNote> {
		return this.antiBot.executeWithProtection(
			async () => {
				const userAgent = this.antiBot.getRandomUserAgent();

				const response = await fetch(url, {
					headers: {
						"User-Agent": userAgent,
						Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
						"Accept-Language":
							"zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2",
						"Accept-Encoding": "gzip, deflate, br",
						DNT: "1",
						Connection: "keep-alive",
						"Upgrade-Insecure-Requests": "1",
					},
				});

				if (!response.ok) {
					throw new Error(`HTTP error ${response.status}`);
				}

				const html = await response.text();

				// 模拟阅读时间
				await this.antiBot.simulateReadingTime(html.length);

				// Extract note details
				const title = this.extractTitle(html);
				const videoUrl = this.extractVideoUrl(html);
				const images = this.extractImages(html);
				const content = this.extractContent(html);
				const isVideo = this.isVideoNote(html);
				const tags = this.extractTags(content);

				const noteId = this.extractNoteId(html);

				return {
					title,
					content,
					url,
					images,
					videos: videoUrl ? [videoUrl] : [],
					tags,
					isVideo,
					rawHtml: html,
					id: noteId,
				};
			},
			requestIndex,
			`导入笔记: ${url.substring(0, 50)}...`,
		);
	}

	/**
	 * Extract note title from HTML
	 */
	private extractTitle(html: string): string {
		const match = html.match(/<title>(.*?)<\/title>/);
		return match
			? match[1].replace(" - 小红书", "")
			: "Untitled Xiaohongshu Note";
	}

	/**
	 * Extract image URLs from note data
	 */
	private extractImages(html: string): string[] {
		const stateMatch = html.match(
			/window\.__INITIAL_STATE__=(.*?)<\/script>/s,
		);
		if (!stateMatch) return [];

		try {
			const jsonStr = stateMatch[1].trim();
			const cleanedJson = jsonStr.replace(/undefined/g, "null");
			const state = JSON.parse(cleanedJson);
			const noteId = Object.keys(state.note.noteDetailMap)[0];
			const imageList =
				state.note.noteDetailMap[noteId].note.imageList || [];
			return imageList
				.map((img: any) => img.urlDefault || "")
				.filter((url: string) => url && url.startsWith("http"));
		} catch (e) {
			console.log(`Failed to parse images: ${(e as Error).message}`);
			return [];
		}
	}

	/**
	 * Extract video URL from note data
	 */
	private extractVideoUrl(html: string): string | null {
		const stateMatch = html.match(
			/window\.__INITIAL_STATE__=(.*?)<\/script>/s,
		);
		if (!stateMatch) return null;

		try {
			const jsonStr = stateMatch[1].trim();
			const cleanedJson = jsonStr.replace(/undefined/g, "null");
			const state = JSON.parse(cleanedJson);
			const noteId = Object.keys(state.note.noteDetailMap)[0];
			const noteData = state.note.noteDetailMap[noteId].note;
			const videoInfo = noteData.video;

			if (!videoInfo || !videoInfo.media || !videoInfo.media.stream)
				return null;

			if (
				videoInfo.media.stream.h264 &&
				videoInfo.media.stream.h264.length > 0
			) {
				return videoInfo.media.stream.h264[0].masterUrl || null;
			}
			if (
				videoInfo.media.stream.h265 &&
				videoInfo.media.stream.h265.length > 0
			) {
				return videoInfo.media.stream.h265[0].masterUrl || null;
			}
			return null;
		} catch (e) {
			console.log(`Failed to parse video URL: ${(e as Error).message}`);
			return null;
		}
	}

	/**
	 * Extract note content from HTML or JSON
	 */
	private extractContent(html: string): string {
		const divMatch = html.match(
			/<div id="detail-desc" class="desc">([\s\S]*?)<\/div>/,
		);
		if (divMatch) {
			return (
				divMatch[1]
					.replace(/<[^>]+>/g, "")
					.replace(/\[话题\]/g, "")
					.replace(/\[[^\]]+\]/g, "")
					.trim() || "Content not found"
			);
		}

		const stateMatch = html.match(
			/window\.__INITIAL_STATE__=(.*?)<\/script>/s,
		);
		if (stateMatch) {
			try {
				const jsonStr = stateMatch[1].trim();
				const cleanedJson = jsonStr.replace(/undefined/g, "null");
				const state = JSON.parse(cleanedJson);
				const noteId = Object.keys(state.note.noteDetailMap)[0];
				const desc = state.note.noteDetailMap[noteId].note.desc || "";
				return (
					desc
						.replace(/\[话题\]/g, "")
						.replace(/\[[^\]]+\]/g, "")
						.trim() || "Content not found"
				);
			} catch (e) {
				console.log(
					`Failed to parse content from JSON: ${(e as Error).message}`,
				);
			}
		}
		return "Content not found";
	}

	/**
	 * Determine if the note is a video note
	 */
	private isVideoNote(html: string): boolean {
		const stateMatch = html.match(
			/window\.__INITIAL_STATE__=(.*?)<\/script>/s,
		);
		if (!stateMatch) return false;

		try {
			const jsonStr = stateMatch[1].trim();
			const cleanedJson = jsonStr.replace(/undefined/g, "null");
			const state = JSON.parse(cleanedJson);
			const noteId = Object.keys(state.note.noteDetailMap)[0];
			const noteType = state.note.noteDetailMap[noteId].note.type;
			return noteType === "video";
		} catch (e) {
			console.log(
				`Failed to determine note type: ${(e as Error).message}`,
			);
			return false;
		}
	}

	/**
	 * Extract tags from content
	 */
	private extractTags(content: string): string[] {
		const tagMatches = content.match(/#\S+/g) || [];
		return tagMatches.map((tag) => tag.replace("#", "").trim());
	}

	/**
	 * Extract note ID from URL or HTML
	 */
	extractNoteId(html: string): string {
		// Try to extract from URL first
		const urlMatch = html.match(
			/https:\/\/www\.xiaohongshu\.com\/explore\/([a-f0-9]+)/,
		);
		if (urlMatch) {
			return urlMatch[1];
		}

		// Try to extract from initial state data
		const stateMatch = html.match(
			/window\.__INITIAL_STATE__=(.*?)<\/script>/s,
		);
		if (stateMatch) {
			try {
				const jsonStr = stateMatch[1].trim();
				const cleanedJson = jsonStr.replace(/undefined/g, "null");
				const state = JSON.parse(cleanedJson);
				const noteId = Object.keys(state.note.noteDetailMap)[0];
				return noteId;
			} catch (e) {
				console.log(
					`Failed to parse note ID from JSON: ${(e as Error).message}`,
				);
			}
		}

		// Fallback: generate ID from URL
		const idFromUrl = html.match(/explore\/([a-f0-9]+)/);
		return idFromUrl ? idFromUrl[1] : Date.now().toString();
	}

	/**
	 * Extract note ID from URL string
	 */
	extractNoteIdFromUrl(url: string): string | null {
		const match = url.match(/\/explore\/([a-f0-9]+)/);
		return match ? match[1] : null;
	}

	/**
	 * Sanitize title for filenames
	 */
	sanitizeFilename(title: string): string {
		let sanitized = title
			.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-_]/g, "")
			.trim();
		sanitized = sanitized.replace(/\s+/g, "-");
		sanitized = sanitized.length > 0 ? sanitized : "Untitled";
		return sanitized.substring(0, 50);
	}
}
