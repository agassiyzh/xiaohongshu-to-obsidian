import {
	S3Client,
	PutObjectCommand,
	HeadObjectCommand,
	DeleteObjectCommand,
	ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Config } from "./types";
import crypto from "crypto";

export interface UploadResult {
	success: boolean;
	url?: string;
	key?: string;
	error?: string;
}

export interface DownloadResult {
	success: boolean;
	buffer?: Buffer;
	contentType?: string;
	error?: string;
}

export class S3Uploader {
	private client: S3Client;
	private config: S3Config;
	private bucket: string;
	private pathPrefix: string;

	constructor(config: S3Config) {
		this.config = config;
		this.bucket = config.bucket;
		this.pathPrefix = config.pathPrefix;

		this.client = new S3Client({
			endpoint: config.endpoint,
			region: config.region,
			credentials: {
				accessKeyId: config.accessKey,
				secretAccessKey: config.secretKey,
			},
			forcePathStyle: config.provider !== "aws",
		});
	}

	async uploadBuffer(
		buffer: Buffer,
		filename: string,
		contentType: string,
	): Promise<UploadResult> {
		const key = `${this.pathPrefix}${filename}`;

		try {
			const upload = new Upload({
				client: this.client,
				params: {
					Bucket: this.bucket,
					Key: key,
					Body: buffer,
					ContentType: contentType,
				},
			});

			await upload.done();

			return {
				success: true,
				url: this.getUrl(key),
				key: key,
			};
		} catch (error) {
			return {
				success: false,
				error: (error as Error).message,
			};
		}
	}

	async uploadFromUrl(url: string): Promise<UploadResult & { localPath?: string }> {
		const downloadResult = await this.downloadFromUrl(url);
		if (!downloadResult.success || !downloadResult.buffer) {
			return {
				success: false,
				error: downloadResult.error || "Failed to download file",
			};
		}

		const ext = this.getExtensionFromUrl(url);
		const hashedFilename = this.generateHashedFilename(downloadResult.buffer, ext);

		const uploadResult = await this.uploadBuffer(
			downloadResult.buffer,
			hashedFilename,
			downloadResult.contentType || this.getContentType(ext),
		);

		return {
			...uploadResult,
		};
	}

	async downloadFromUrl(url: string): Promise<DownloadResult> {
		try {
			const fetch = (await import("node-fetch")).default;
			const response = await fetch(url, {
				signal: AbortSignal.timeout(this.config.retry.timeout),
			});

			if (!response.ok) {
				return {
					success: false,
					error: `HTTP error ${response.status}`,
				};
			}

			const buffer = await response.buffer();
			const contentType = response.headers.get("content-type") || "application/octet-stream";

			return {
				success: true,
				buffer: buffer,
				contentType: contentType,
			};
		} catch (error) {
			return {
				success: false,
				error: (error as Error).message,
			};
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			await this.client.send(
				new HeadObjectCommand({
					Bucket: this.bucket,
					Key: key,
				}),
			);
			return true;
		} catch {
			return false;
		}
	}

	async delete(key: string): Promise<boolean> {
		try {
			await this.client.send(
				new DeleteObjectCommand({
					Bucket: this.bucket,
					Key: key,
				}),
			);
			return true;
		} catch {
			return false;
		}
	}

	async listObjects(prefix?: string): Promise<string[]> {
		const keys: string[] = [];
		const effectivePrefix = prefix || this.pathPrefix;

		try {
			let continuationToken: string | undefined;
			do {
				const response = await this.client.send(
					new ListObjectsV2Command({
						Bucket: this.bucket,
						Prefix: effectivePrefix,
						ContinuationToken: continuationToken,
					}),
				);

				if (response.Contents) {
					for (const obj of response.Contents) {
						if (obj.Key) {
							keys.push(obj.Key);
						}
					}
				}

				continuationToken = response.NextContinuationToken;
			} while (continuationToken);

			return keys;
		} catch {
			return [];
		}
	}

	getUrl(key: string): string {
		const cleanEndpoint = this.config.endpoint.replace(/\/$/, "");
		return `${cleanEndpoint}/${this.bucket}/${key}`;
	}

	generateHashedFilename(buffer: Buffer, ext: string): string {
		const hash = crypto.createHash("md5").update(buffer).digest("hex");
		return `${hash}${ext}`;
	}

	private getExtensionFromUrl(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;
			const ext = pathname.split(".").pop()?.split("?")[0] || "";
			
			if (url.includes("video") || url.includes(".mp4")) {
				return ".mp4";
			}
			
			const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
			if (imageExts.includes(`.${ext.toLowerCase()}`)) {
				return `.${ext.toLowerCase()}`;
			}
			
			return ".jpg";
		} catch {
			return ".jpg";
		}
	}

	private getContentType(ext: string): string {
		const contentTypes: Record<string, string> = {
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".png": "image/png",
			".gif": "image/gif",
			".webp": "image/webp",
			".mp4": "video/mp4",
			".webm": "video/webm",
		};
		return contentTypes[ext] || "application/octet-stream";
	}

	isS3Url(url: string): boolean {
		const generatedUrl = this.getUrl("test-key");
		const baseUrl = generatedUrl.replace("/test-key", "");
		
		return url.startsWith(baseUrl);
	}
}
