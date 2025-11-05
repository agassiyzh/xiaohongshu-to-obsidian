import { Config, XHSNote } from "./types";

export interface AIProvider {
	categorize(
		note: XHSNote,
		categories: string[],
		systemPrompt: string,
	): Promise<string>;
}

export class OpenAIProvider implements AIProvider {
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string = "gpt-3.5-turbo") {
		this.apiKey = apiKey;
		this.model = model;
	}

	async categorize(
		note: XHSNote,
		categories: string[],
		systemPrompt: string,
	): Promise<string> {
		const { OpenAI } = await import("openai");
		const openai = new OpenAI({ apiKey: this.apiKey });

		const userPrompt = this.buildPrompt(note, categories);

		try {
			const response = await openai.chat.completions.create({
				model: this.model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
				max_tokens: 50,
				temperature: 0.3,
			});

			const category = response.choices[0]?.message?.content?.trim();
			return category || "其他";
		} catch (error) {
			console.error("OpenAI API error:", error);
			throw new Error(
				`AI categorization failed: ${(error as Error).message}`,
			);
		}
	}

	private buildPrompt(note: XHSNote, categories: string[]): string {
		return `请分析以下小红书笔记并选择最合适的分类：

标题：${note.title}
内容：${note.content.substring(0, 500)}${note.content.length > 500 ? "..." : ""}
标签：${note.tags.join(", ")}
类型：${note.isVideo ? "视频" : "图文"}

可用分类：
${categories.map((cat) => `- ${cat}`).join("\n")}

请只返回最合适的分类名称。`;
	}
}

export class AnthropicProvider implements AIProvider {
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string = "claude-3-haiku-20240307") {
		this.apiKey = apiKey;
		this.model = model;
	}

	async categorize(
		note: XHSNote,
		categories: string[],
		systemPrompt: string,
	): Promise<string> {
		const fetch = (await import("node-fetch")).default;

		const userPrompt = this.buildPrompt(note, categories);

		try {
			const response = await fetch(
				"https://api.anthropic.com/v1/messages",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": this.apiKey,
						"anthropic-version": "2023-06-01",
					},
					body: JSON.stringify({
						model: this.model,
						max_tokens: 50,
						system: systemPrompt,
						messages: [{ role: "user", content: userPrompt }],
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}`);
			}

			const data = (await response.json()) as any;
			const category = data.content?.[0]?.text?.trim();
			return category || "其他";
		} catch (error) {
			console.error("Anthropic API error:", error);
			throw new Error(
				`AI categorization failed: ${(error as Error).message}`,
			);
		}
	}

	private buildPrompt(note: XHSNote, categories: string[]): string {
		return `请分析以下小红书笔记并选择最合适的分类：

标题：${note.title}
内容：${note.content.substring(0, 500)}${note.content.length > 500 ? "..." : ""}
标签：${note.tags.join(", ")}
类型：${note.isVideo ? "视频" : "图文"}

可用分类：
${categories.map((cat) => `- ${cat}`).join("\n")}

请只返回最合适的分类名称。`;
	}
}

export class DeepSeekProvider implements AIProvider {
	private apiKey: string;
	private model: string;
	private baseURL: string;

	constructor(apiKey: string, model: string = "deepseek-chat") {
		this.apiKey = apiKey;
		this.model = model;
		this.baseURL = "https://api.deepseek.com";
	}

	async categorize(
		note: XHSNote,
		categories: string[],
		systemPrompt: string,
	): Promise<string> {
		const fetch = (await import("node-fetch")).default;

		const userPrompt = this.buildPrompt(note, categories);

		// 确保 systemPrompt 不为空
		const effectiveSystemPrompt =
			systemPrompt.trim() ||
			"你是一个专业的内容分类助手。请根据提供的内容选择最合适的分类。";

		// 构建请求体
		const requestBody = {
			model: this.model,
			messages: [
				{ role: "system", content: effectiveSystemPrompt },
				{ role: "user", content: userPrompt },
			],
			max_tokens: 50,
			temperature: 0.3,
			stream: false,
		};

		// 调试信息（开发时使用）
		if (process.env.DEBUG_AI) {
			console.log(
				"DeepSeek API Request:",
				JSON.stringify(requestBody, null, 2),
			);
		}

		try {
			const response = await fetch(
				`${this.baseURL}/v1/chat/completions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify(requestBody),
				},
			);

			if (!response.ok) {
				const errorData = (await response
					.json()
					.catch(() => ({}))) as any;
				throw new Error(
					`HTTP error ${response.status}: ${errorData.error?.message || response.statusText}`,
				);
			}

			const data = (await response.json()) as any;
			const category = data.choices?.[0]?.message?.content?.trim();
			return category || "其他";
		} catch (error) {
			console.error("DeepSeek API error:", error);
			throw new Error(
				`AI categorization failed: ${(error as Error).message}`,
			);
		}
	}

	private buildPrompt(note: XHSNote, categories: string[]): string {
		return `请分析以下小红书笔记并选择最合适的分类：

标题：${note.title}
内容：${note.content.substring(0, 500)}${note.content.length > 500 ? "..." : ""}
标签：${note.tags.join(", ")}
类型：${note.isVideo ? "视频" : "图文"}

可用分类：
${categories.map((cat) => `- ${cat}`).join("\n")}

请只返回最合适的分类名称。`;
	}
}

export class AIClassifier {
	private provider: AIProvider;
	private config: Config["ai"];

	constructor(config: Config["ai"]) {
		this.config = config;

		if (!config.enabled) {
			throw new Error("AI classification is disabled");
		}

		if (config.provider === "openai") {
			if (!config.apiKey) {
				throw new Error("OpenAI API key is required");
			}
			this.provider = new OpenAIProvider(config.apiKey, config.model);
		} else if (config.provider === "anthropic") {
			if (!config.apiKey) {
				throw new Error("Anthropic API key is required");
			}
			this.provider = new AnthropicProvider(config.apiKey, config.model);
		} else if (config.provider === "deepseek") {
			if (!config.apiKey) {
				throw new Error("DeepSeek API key is required");
			}
			this.provider = new DeepSeekProvider(config.apiKey, config.model);
		} else {
			throw new Error(`Unsupported AI provider: ${config.provider}`);
		}
	}

	async categorizeNote(note: XHSNote, categories: string[]): Promise<string> {
		try {
			// 确保 systemPrompt 不为空
			const systemPrompt =
				this.config.systemPrompt?.trim() ||
				"你是一个专业的内容分类助手。请根据提供的内容选择最合适的分类。";

			const category = await this.provider.categorize(
				note,
				categories,
				systemPrompt,
			);

			// 验证返回的分类是否在列表中
			if (!categories.includes(category)) {
				console.warn(
					`AI returned category "${category}" which is not in the predefined list, using "其他"`,
				);
				return "其他";
			}

			return category;
		} catch (error) {
			console.error("AI categorization failed:", error);
			return "其他";
		}
	}

	// 基于关键词的简单分类（作为AI分类的备选方案）
	static keywordBasedCategorize(note: XHSNote, categories: string[]): string {
		const text =
			`${note.title} ${note.content} ${note.tags.join(" ")}`.toLowerCase();

		const keywordMap: { [key: string]: string[] } = {
			美食: [
				"吃",
				"美食",
				"餐厅",
				"料理",
				"菜谱",
				"食谱",
				"好吃",
				"味道",
				"口感",
			],
			旅行: [
				"旅行",
				"旅游",
				"景点",
				"攻略",
				"路线",
				"目的地",
				"酒店",
				"机票",
				"度假",
			],
			娱乐: [
				"电影",
				"电视剧",
				"综艺",
				"游戏",
				"音乐",
				"明星",
				"演员",
				"歌手",
			],
			知识: [
				"学习",
				"知识",
				"科普",
				"教程",
				"技能",
				"方法",
				"技巧",
				"原理",
			],
			工作: [
				"工作",
				"职场",
				"面试",
				"简历",
				"薪资",
				"公司",
				"同事",
				"领导",
			],
			情感: [
				"恋爱",
				"感情",
				"情感",
				"分手",
				"结婚",
				"夫妻",
				"男女",
				"心理",
			],
			个人成长: [
				"成长",
				"进步",
				"提升",
				"习惯",
				"自律",
				"目标",
				"计划",
				"时间管理",
			],
			优惠: [
				"优惠",
				"折扣",
				"省钱",
				"便宜",
				"价格",
				"购买",
				"商品",
				"购物",
			],
			搞笑: [
				"搞笑",
				"有趣",
				"好玩",
				"段子",
				"笑话",
				"幽默",
				"爆笑",
				"开心",
			],
			育儿: [
				"孩子",
				"宝宝",
				"育儿",
				"教育",
				"儿童",
				"亲子",
				"妈妈",
				"爸爸",
			],
		};

		for (const [category, keywords] of Object.entries(keywordMap)) {
			if (
				categories.includes(category) &&
				keywords.some((keyword) => text.includes(keyword))
			) {
				return category;
			}
		}

		return "其他";
	}
}
