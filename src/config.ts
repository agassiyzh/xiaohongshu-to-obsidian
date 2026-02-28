import fs from "fs/promises";
import path from "path";
import { Config } from "./types";

const DEFAULT_CONFIG: Config = {
	baseFolder: "XHS Notes",
	basePath: "",
	categories: [
		"美食",
		"旅行",
		"娱乐",
		"知识",
		"软件",
		"AI",
		"DIY",
		"情感",
		"个人成长",
		"健康",
		"摄影",
		"3D打印",
		"园艺",
		"育儿",
	],
	downloadMedia: true,
	s3: {
		enabled: false,
		provider: "minio",
		endpoint: "",
		bucket: "",
		accessKey: "",
		secretKey: "",
		region: "us-east-1",
		pathPrefix: "xiaohongshu/",
		uploadStrategy: "both",
		retry: {
			maxRetries: 3,
			timeout: 60000,
		},
	},
	ai: {
		enabled: false,
		provider: "openai",
		apiKey: "",
		model: "gpt-3.5-turbo",
		systemPrompt: `你是一个专业的分类助手。请根据小红书笔记的内容、标题和标签，将其分类到最合适的分类中。

可用的分类：
- 美食：与食物、烹饪、餐厅相关的内容
- 旅行：旅游攻略、景点推荐、旅行体验
- 娱乐：影视、音乐、游戏等娱乐内容
- 知识：科普、学习、教育类内容
- 软件：软件应用、开发工具、APP推荐相关内容
- AI：人工智能、机器学习、ChatGPT、AI工具相关内容
- DIY：手工制作、自己动手、创意改造相关内容
- 情感：情感故事、恋爱技巧、心理相关
- 个人成长：自我提升、学习方法、技能培养
- 健康：健康养生、运动健身、医疗保健、心理健康相关内容
- 摄影：摄影技巧、相机设备、拍照构图、后期处理相关内容
- 3D打印：3D打印技术、模型制作、打印相关内容
- 园艺：植物种植、花园管理、花卉相关内容
- 育儿：育儿经验、亲子教育、儿童成长

请只返回分类名称，不要解释。如果无法确定分类，请返回"其他"。`,
	},
	antiBot: {
		enabled: true,
		minDelay: 2000,
		maxDelay: 8000,
		randomDelayRange: 3000,
		typingSimulation: true,
		readingTimeRange: [3, 10],
		browsingTimeRange: [5, 15],
		progressiveDelay: true,
		progressiveFactor: 1.5,
		rotateUserAgent: true,
		userAgents: [
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		],
		maxRetries: 3,
		retryDelayBase: 1000,
		exponentialBackoff: true,
		rateLimitPerMinute: 30,
		burstLimit: 5,
	},
	output: {
		includeMediaInMarkdown: true,
		createMediaFolder: true,
	},
};

const CONFIG_FILE = "xhs-importer.config.json";

export class ConfigManager {
	private configPath: string;

	constructor(configDir?: string) {
		this.configPath = path.join(configDir || process.cwd(), CONFIG_FILE);
	}

	async loadConfig(): Promise<Config> {
		try {
			const configData = await fs.readFile(this.configPath, "utf-8");
			const config = JSON.parse(configData);
			return { ...DEFAULT_CONFIG, ...config };
		} catch (error) {
			if ((error as any).code === "ENOENT") {
				await this.saveConfig(DEFAULT_CONFIG);
				return DEFAULT_CONFIG;
			}
			throw error;
		}
	}

	async saveConfig(config: Config): Promise<void> {
		await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
	}

	async updateConfig(updates: Partial<Config>): Promise<Config> {
		const currentConfig = await this.loadConfig();
		const newConfig = { ...currentConfig, ...updates };
		await this.saveConfig(newConfig);
		return newConfig;
	}

	static async createDefaultConfig(): Promise<Config> {
		return DEFAULT_CONFIG;
	}
}
