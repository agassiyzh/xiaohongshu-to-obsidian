export interface S3Config {
	enabled: boolean;
	provider: "aws" | "minio" | "aliyun" | "tencent";
	endpoint: string;
	bucket: string;
	accessKey: string;
	secretKey: string;
	region: string;
	pathPrefix: string;
	uploadStrategy: "s3-only" | "local-only" | "both";
	retry: {
		maxRetries: number;
		timeout: number;
	};
}

export interface Config {
	baseFolder: string;
	basePath?: string;
	categories: string[];
	downloadMedia: boolean;
	s3: S3Config;
	ai: {
		enabled: boolean;
		provider: "openai" | "anthropic" | "deepseek";
		apiKey: string;
		model: string;
		systemPrompt: string;
	};
	antiBot: {
		enabled: boolean;
		minDelay: number;
		maxDelay: number;
		randomDelayRange: number;
		typingSimulation: boolean;
		readingTimeRange: [number, number];
		browsingTimeRange: [number, number];
		progressiveDelay: boolean;
		progressiveFactor: number;
		rotateUserAgent: boolean;
		userAgents: string[];
		maxRetries: number;
		retryDelayBase: number;
		exponentialBackoff: boolean;
		rateLimitPerMinute: number;
		burstLimit: number;
	};
	output: {
		includeMediaInMarkdown: boolean;
		createMediaFolder: boolean;
	};
}

export interface XHSNote {
	title: string;
	content: string;
	url: string;
	images: string[];
	videos: string[];
	tags: string[];
	isVideo: boolean;
	rawHtml: string;
	id: string;
	category?: string;
}

export interface MediaInfo {
	type: "image" | "video";
	url: string;
	line?: number;
	originalUrl: string;
}

export interface ReplaceResult {
	filePath: string;
	success: boolean;
	replaced: number;
	failed: MediaInfo[];
	skipped: number[];
}

export interface ImportResult {
	filePath: string;
	category: string;
	mediaFiles: string[];
	mediaUrls?: string[];
	success: boolean;
	error?: string;
}
