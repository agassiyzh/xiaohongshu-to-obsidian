import { performance } from 'perf_hooks';

export interface AntiBotConfig {
	enabled: boolean;
	// 基础延迟设置
	minDelay: number;      // 最小延迟（毫秒）
	maxDelay: number;      // 最大延迟（毫秒）

	// 人类行为模拟
	randomDelayRange: number;     // 随机延迟范围（毫秒）
	typingSimulation: boolean;    // 是否模拟打字速度
	readingTimeRange: [number, number]; // 阅读时间范围（秒）
	browsingTimeRange: [number, number]; // 浏览时间范围（秒）

	// 请求间隔管理
	progressiveDelay: boolean;    // 是否启用渐进延迟
	progressiveFactor: number;    // 渐进因子

	// User-Agent 轮换
	rotateUserAgent: boolean;
	userAgents: string[];

	// 错误处理
	maxRetries: number;            // 最大重试次数
	retryDelayBase: number;        // 重试延迟基数
	exponentialBackoff: boolean;  // 是否使用指数退避

	// 速率限制
	rateLimitPerMinute: number;   // 每分钟最大请求数
	burstLimit: number;           // 突发请求限制
}

export const DEFAULT_ANTI_BOT_CONFIG: AntiBotConfig = {
	enabled: true,
	minDelay: 2000,               // 2秒最小延迟
	maxDelay: 8000,               // 8秒最大延迟
	randomDelayRange: 3000,       // ±3秒随机延迟
	typingSimulation: true,        // 模拟打字速度
	readingTimeRange: [3, 10],    // 3-10秒阅读时间
	browsingTimeRange: [5, 15],   // 5-15秒浏览时间
	progressiveDelay: true,       // 启用渐进延迟
	progressiveFactor: 1.5,       // 每次延迟增加1.5倍
	rotateUserAgent: true,        // 轮换User-Agent
	userAgents: [
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
		'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
	],
	maxRetries: 3,
	retryDelayBase: 1000,
	exponentialBackoff: true,
	rateLimitPerMinute: 30,
	burstLimit: 5
};

export class AntiBotProtection {
	private config: AntiBotConfig;
	private requestCount = 0;
	private lastRequestTime = 0;
	private requestHistory: number[] = [];
	private consecutiveErrors = 0;
	private currentUserAgentIndex = 0;

	constructor(config: Partial<AntiBotConfig> = {}) {
		this.config = { ...DEFAULT_ANTI_BOT_CONFIG, ...config };
	}

	/**
	 * 获取随机User-Agent
	 */
	getRandomUserAgent(): string {
		if (!this.config.rotateUserAgent || this.config.userAgents.length === 0) {
			return this.config.userAgents[0] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
		}

		// 轮换User-Agent
		const userAgent = this.config.userAgents[this.currentUserAgentIndex];
		this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.config.userAgents.length;
		return userAgent;
	}

	/**
	 * 计算人类化延迟
	 */
	calculateHumanDelay(requestIndex: number): number {
		let baseDelay = this.config.minDelay;

		// 渐进延迟
		if (this.config.progressiveDelay && requestIndex > 0) {
			const progressiveDelay = Math.min(
				this.config.maxDelay,
				baseDelay * Math.pow(this.config.progressiveFactor, Math.floor(requestIndex / 5))
			);
			baseDelay = Math.max(baseDelay, progressiveDelay);
		}

		// 添加随机延迟
		const randomDelay = Math.random() * this.config.randomDelayRange - this.config.randomDelayRange / 2;
		const totalDelay = Math.max(this.config.minDelay, baseDelay + randomDelay);

		// 如果连续出错，增加延迟
		if (this.consecutiveErrors > 0) {
			const errorDelay = this.consecutiveErrors * 2000; // 每次错误增加2秒
			return totalDelay + errorDelay;
		}

		return totalDelay;
	}

	/**
	 * 模拟人类阅读时间
	 */
	simulateReadingTime(contentLength: number): Promise<void> {
		return new Promise(resolve => {
			if (!this.config.typingSimulation) {
				setTimeout(resolve, 1000);
				return;
			}

			// 基于内容长度计算阅读时间
			const readingSpeed = 200; // 每分钟200字（平均阅读速度）
			const baseReadingTime = (contentLength / readingSpeed) * 60 * 1000; // 转换为毫秒
			const [minTime, maxTime] = this.config.readingTimeRange;
			const readingTime = Math.max(minTime * 1000, Math.min(maxTime * 1000, baseReadingTime));

			// 添加随机性
			const randomVariation = readingTime * 0.3 * (Math.random() - 0.5);
			const finalReadingTime = readingTime + randomVariation;

			setTimeout(resolve, finalReadingTime);
		});
	}

	/**
	 * 模拟浏览时间
	 */
	simulateBrowsingTime(): Promise<void> {
		return new Promise(resolve => {
			const [minTime, maxTime] = this.config.browsingTimeRange;
			const browsingTime = minTime + Math.random() * (maxTime - minTime);
			setTimeout(resolve, browsingTime * 1000);
		});
	}

	/**
	 * 检查速率限制
	 */
	async checkRateLimit(): Promise<void> {
		const now = Date.now();

		// 清理1分钟前的请求记录
		this.requestHistory = this.requestHistory.filter(time => now - time < 60000);

		// 检查每分钟限制
		if (this.requestHistory.length >= this.config.rateLimitPerMinute) {
			const oldestRequest = Math.min(...this.requestHistory);
			const waitTime = 60000 - (now - oldestRequest);
			if (waitTime > 0) {
				console.log(`⏳ 达到速率限制，等待 ${Math.ceil(waitTime / 1000)} 秒...`);
				await this.sleep(waitTime);
			}
		}

		// 检查突发限制
		const recentRequests = this.requestHistory.filter(time => now - time < 10000).length;
		if (recentRequests >= this.config.burstLimit) {
			const waitTime = 10000 - (now - Math.min(...this.requestHistory.slice(-this.config.burstLimit)));
			if (waitTime > 0) {
				console.log(`⚠️  达到突发限制，等待 ${Math.ceil(waitTime / 1000)} 秒...`);
				await this.sleep(waitTime);
			}
		}

		this.requestHistory.push(now);
	}

	/**
	 * 执行带防护的请求
	 */
	async executeWithProtection<T>(
		requestFn: () => Promise<T>,
		requestIndex: number,
		context?: string
	): Promise<T> {
		if (!this.config.enabled) {
			return requestFn();
		}

		// 检查速率限制
		await this.checkRateLimit();

		// 计算延迟
		const delay = this.calculateHumanDelay(requestIndex);
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < delay) {
			const waitTime = delay - timeSinceLastRequest;
			if (context) {
				console.log(`⏳ ${context} - 等待 ${Math.ceil(waitTime / 1000)} 秒...`);
			}
			await this.sleep(waitTime);
		}

		// 执行请求（带重试机制）
		return this.executeWithRetry(requestFn, context);
	}

	/**
	 * 带重试机制的请求执行
	 */
	private async executeWithRetry<T>(
		requestFn: () => Promise<T>,
		context?: string,
		attempt: number = 1
	): Promise<T> {
		try {
			const result = await requestFn();
			this.consecutiveErrors = 0; // 重置错误计数
			this.lastRequestTime = Date.now();
			this.requestCount++;

			if (context) {
				console.log(`✅ ${context} - 请求成功 (尝试 ${attempt})`);
			}

			return result;
		} catch (error) {
			this.consecutiveErrors++;

			if (attempt <= this.config.maxRetries) {
				let retryDelay = this.config.retryDelayBase;

				if (this.config.exponentialBackoff) {
					retryDelay = this.config.retryDelayBase * Math.pow(2, attempt - 1);
				}

				// 添加随机抖动
				retryDelay += Math.random() * 1000;

				console.log(`⚠️  ${context} - 请求失败，${retryDelay}ms 后重试 (尝试 ${attempt}/${this.config.maxRetries})`);
				console.log(`   错误: ${(error as Error).message}`);

				await this.sleep(retryDelay);
				return this.executeWithRetry(requestFn, context, attempt + 1);
			} else {
				console.log(`❌ ${context} - 请求最终失败，已达到最大重试次数`);
				throw error;
			}
		}
	}

	/**
	 * 获取请求统计
	 */
	getStatistics() {
		return {
			totalRequests: this.requestCount,
			consecutiveErrors: this.consecutiveErrors,
			lastRequestTime: this.lastRequestTime,
			recentRequestsPerMinute: this.requestHistory.length,
			enabled: this.config.enabled
		};
	}

	/**
	 * 重置统计
	 */
	resetStatistics() {
		this.requestCount = 0;
		this.lastRequestTime = 0;
		this.requestHistory = [];
		this.consecutiveErrors = 0;
		this.currentUserAgentIndex = 0;
	}

	/**
	 * 睡眠函数
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * 获取当前配置
	 */
	getConfig(): AntiBotConfig {
		return { ...this.config };
	}

	/**
	 * 更新配置
	 */
	updateConfig(newConfig: Partial<AntiBotConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}
}
