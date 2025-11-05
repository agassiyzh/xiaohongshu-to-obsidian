export interface Config {
	baseFolder: string;
	basePath?: string; // 指定XHS Notes基础目录的完整路径，如果为空则使用当前目录
	categories: string[];
	downloadMedia: boolean;
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

export interface ImportResult {
	filePath: string;
	category: string;
	mediaFiles: string[];
	success: boolean;
	error?: string;
}
