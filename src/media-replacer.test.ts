import { MediaReplacer } from './media-replacer';
import { S3Config, Config } from './types';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('MediaReplacer', () => {
	let tempDir: string;
	let s3Config: S3Config;
	let config: Config;
	let replacer: MediaReplacer;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'media-replacer-test-'));
		s3Config = {
			enabled: true,
			provider: 'minio',
			endpoint: 'http://localhost:9000',
			bucket: 'testbucket',
			accessKey: 'testkey',
			secretKey: 'testsecret',
			region: 'us-east-1',
			pathPrefix: 'xiaohongshu/',
			uploadStrategy: 'both',
			retry: {
				maxRetries: 3,
				timeout: 60000,
			},
		};
		config = {
			baseFolder: 'XHS Notes',
			categories: ['美食', '旅行', '其他'],
			downloadMedia: true,
			s3: s3Config,
			ai: {
				enabled: false,
				provider: 'openai',
				apiKey: '',
				model: 'gpt-3.5-turbo',
				systemPrompt: '',
			},
			antiBot: {
				enabled: false,
				minDelay: 1000,
				maxDelay: 3000,
				randomDelayRange: 1000,
				typingSimulation: false,
				readingTimeRange: [3000, 8000],
				browsingTimeRange: [5000, 15000],
				progressiveDelay: true,
				progressiveFactor: 1.5,
				rotateUserAgent: true,
				userAgents: [],
				maxRetries: 3,
				retryDelayBase: 1000,
				exponentialBackoff: true,
				rateLimitPerMinute: 10,
				burstLimit: 3,
			},
			output: {
				includeMediaInMarkdown: true,
				createMediaFolder: true,
			},
		};
		replacer = new MediaReplacer(s3Config, config);
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	describe('isS3Url', () => {
		it('should return true for s3:// protocol', () => {
			const result = (replacer as any).isS3Url('s3://bucket/path/image.jpg');
			expect(result).toBe(true);
		});

		it('should return true for URL containing bucket name', () => {
			const result = (replacer as any).isS3Url('http://localhost:9000/testbucket/path/image.jpg');
			expect(result).toBe(true);
		});

		it('should return true for URL containing endpoint', () => {
			const result = (replacer as any).isS3Url('http://localhost:9000/path/image.jpg');
			expect(result).toBe(true);
		});

		it('should return false for regular HTTP URL', () => {
			const result = (replacer as any).isS3Url('https://example.com/image.jpg');
			expect(result).toBe(false);
		});

		it('should return false for relative path', () => {
			const result = (replacer as any).isS3Url('../media/image.jpg');
			expect(result).toBe(false);
		});

		it('should handle endpoint without trailing slash', () => {
			const result = (replacer as any).isS3Url('http://localhost:9000/path/image.jpg');
			expect(result).toBe(true);
		});
	});

	describe('matchFilter', () => {
		it('should match type filter for image', () => {
			const mediaInfo = { type: 'image' as const, url: 'test.jpg', originalUrl: 'test.jpg' };
			const result = (replacer as any).matchFilter('type:image', mediaInfo);
			expect(result).toBe(true);
		});

		it('should match type filter for video', () => {
			const mediaInfo = { type: 'video' as const, url: 'test.mp4', originalUrl: 'test.mp4' };
			const result = (replacer as any).matchFilter('type:video', mediaInfo);
			expect(result).toBe(true);
		});

		it('should not match type filter for wrong type', () => {
			const mediaInfo = { type: 'image' as const, url: 'test.jpg', originalUrl: 'test.jpg' };
			const result = (replacer as any).matchFilter('type:video', mediaInfo);
			expect(result).toBe(false);
		});

		it('should return true for unknown filter type', () => {
			const mediaInfo = { type: 'image' as const, url: 'test.jpg', originalUrl: 'test.jpg' };
			const result = (replacer as any).matchFilter('unknown:value', mediaInfo);
			expect(result).toBe(true);
		});

		it('should always return false for category filter', () => {
			const mediaInfo = { type: 'image' as const, url: 'test.jpg', originalUrl: 'test.jpg' };
			const result = (replacer as any).matchFilter('category:美食', mediaInfo);
			expect(result).toBe(false);
		});
	});

	describe('extractCategoryFromPath', () => {
		it('should extract category from path', () => {
			const filePath = path.join(tempDir, '美食', 'note.md');
			const result = (replacer as any).extractCategoryFromPath(filePath, tempDir);
			expect(result).toBe('美食');
		});

		it('should return category for media folder', () => {
			const filePath = path.join(tempDir, 'media', 'note.md');
			const result = (replacer as any).extractCategoryFromPath(filePath, tempDir);
			expect(result).toBe('media');
		});

		it('should return Unknown for root folder', () => {
			const filePath = path.join(tempDir, 'note.md');
			const result = (replacer as any).extractCategoryFromPath(filePath, tempDir);
			expect(result).toBe('Unknown');
		});
	});

	describe('extractMediaUrls', () => {
		it('should extract image URLs from markdown', () => {
			const content = `
# Test

![Image 1](https://example.com/image1.jpg)

![Image 2](https://example.com/image2.jpg)
`;
			const result = (replacer as any).extractMediaUrls(content);
			expect(result).toHaveLength(2);
			expect(result[0].url).toBe('https://example.com/image1.jpg');
			expect(result[0].type).toBe('image');
		});

		it('should extract video URLs from markdown', () => {
			const content = `
# Test

<video src="https://example.com/video.mp4"></video>
`;
			const result = (replacer as any).extractMediaUrls(content);
			expect(result).toHaveLength(1);
			expect(result[0].url).toBe('https://example.com/video.mp4');
			expect(result[0].type).toBe('video');
		});

		it('should extract cover from frontmatter', () => {
			const content = `---
title: Test
cover: https://example.com/cover.jpg
---

# Content
`;
			const result = (replacer as any).extractMediaUrls(content);
			expect(result.some((u: any) => u.url === 'https://example.com/cover.jpg')).toBe(true);
		});

		it('should skip relative paths in cover', () => {
			const content = `---
title: Test
cover: ../media/cover.jpg
---

# Content
`;
			const result = (replacer as any).extractMediaUrls(content);
			expect(result.some((u: any) => u.url === '../media/cover.jpg')).toBe(false);
		});

		it('should skip S3 URLs in cover', () => {
			const content = `---
title: Test
cover: s3://bucket/cover.jpg
---

# Content
`;
			const result = (replacer as any).extractMediaUrls(content);
			expect(result.some((u: any) => u.url === 's3://bucket/cover.jpg')).toBe(false);
		});
	});

	describe('extractNonS3Urls', () => {
		beforeEach(async () => {
			await fs.mkdir(path.join(tempDir, '测试'), { recursive: true });
		});

		it('should extract URLs that are not S3 URLs', async () => {
			const content = `---
title: Test
---

# Content

![Image](https://example.com/image.jpg)
`;
			const filePath = path.join(tempDir, 'test.md');
			await fs.writeFile(filePath, content);

			const result = await replacer.extractNonS3Urls(filePath);
			expect(result).toHaveLength(1);
			expect(result[0].url).toBe('https://example.com/image.jpg');
		});

		it('should filter out S3 URLs', async () => {
			const content = `---
title: Test
---

# Content

![Image](https://example.com/image.jpg)
![S3 Image](http://localhost:9000/testbucket/image.jpg)
`;
			const filePath = path.join(tempDir, 'test.md');
			await fs.writeFile(filePath, content);

			const result = await replacer.extractNonS3Urls(filePath);
			expect(result).toHaveLength(1);
			expect(result[0].url).toBe('https://example.com/image.jpg');
		});

		it('should filter out relative paths', async () => {
			const content = `---
title: Test
---

# Content

![Local](../media/image.jpg)
![Remote](https://example.com/image.jpg)
`;
			const filePath = path.join(tempDir, 'test.md');
			await fs.writeFile(filePath, content);

			const result = await replacer.extractNonS3Urls(filePath);
			expect(result).toHaveLength(1);
			expect(result[0].url).toBe('https://example.com/image.jpg');
		});

		it('should apply type filter', async () => {
			const content = `---
title: Test
---

# Content

![Image](https://example.com/image.jpg)
<video src="https://example.com/video.mp4"></video>
`;
			const filePath = path.join(tempDir, 'test.md');
			await fs.writeFile(filePath, content);

			const result = await replacer.extractNonS3Urls(filePath, 'type:video');
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('video');
		});

		it('should return empty array for non-existent file', async () => {
			const result = await replacer.extractNonS3Urls(path.join(tempDir, 'nonexistent.md'));
			expect(result).toEqual([]);
		});
	});

	describe('extractLocalUrls', () => {
		beforeEach(async () => {
			await fs.mkdir(path.join(tempDir, '测试'), { recursive: true });
		});

		it('should extract only relative URLs', async () => {
			const content = `---
title: Test
---

# Content

![Local](../media/image.jpg)
![Remote](https://example.com/image.jpg)
`;
			const filePath = path.join(tempDir, 'test.md');
			await fs.writeFile(filePath, content);

			const result = await replacer.extractLocalUrls(filePath);
			expect(result).toHaveLength(1);
			expect(result[0].url).toBe('../media/image.jpg');
		});

		it('should apply filter to local URLs', async () => {
			const content = `---
title: Test
---

# Content

![Image](../media/image.jpg)
<video src="../media/video.mp4"></video>
`;
			const filePath = path.join(tempDir, 'test.md');
			await fs.writeFile(filePath, content);

			const result = await replacer.extractLocalUrls(filePath, 'type:video');
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('video');
		});
	});

	describe('scanMarkdownFiles', () => {
		beforeEach(async () => {
			await fs.mkdir(path.join(tempDir, '美食'), { recursive: true });
			await fs.writeFile(path.join(tempDir, 'note1.md'), '# Test 1');
			await fs.writeFile(path.join(tempDir, '美食', 'note2.md'), '# Test 2');
			await fs.writeFile(path.join(tempDir, 'note3.txt'), 'Not markdown');
		});

		it('should scan markdown files recursively', async () => {
			const files = await (replacer as any).scanMarkdownFiles(tempDir);
			expect(files).toHaveLength(2);
			expect(files.some((f: string) => f.includes('note1.md'))).toBe(true);
			expect(files.some((f: string) => f.includes('note2.md'))).toBe(true);
		});

		it('should exclude non-markdown files', async () => {
			const files = await (replacer as any).scanMarkdownFiles(tempDir);
			expect(files.some((f: string) => f.includes('note3.txt'))).toBe(false);
		});
	});
});
