import { FileManager } from './file-manager';
import { XHSNote } from './types';

describe('FileManager', () => {
	let fileManager: FileManager;

	beforeEach(() => {
		fileManager = new FileManager('XHS Notes', true, '/tmp/test');
	});

	describe('sanitizeTitle', () => {
		it('should remove special characters', () => {
			const result = (fileManager as any).sanitizeTitle('Test: <Title> with "quotes"');
			expect(result).toBe('Test-Title-with-quotes');
		});

		it('should handle mixed content with hashtag', () => {
			const result = (fileManager as any).sanitizeTitle('北京美食攻略#test');
			expect(result).toBe('北京美食攻略-test');
		});

		it('should replace spaces with hyphens', () => {
			const result = (fileManager as any).sanitizeTitle('Test Title With Spaces');
			expect(result).toBe('Test-Title-With-Spaces');
		});

		it('should remove leading and trailing hyphens', () => {
			const result = (fileManager as any).sanitizeTitle('---Test Title---');
			expect(result).toBe('Test-Title');
		});

		it('should truncate to 50 characters', () => {
			const longTitle = 'A'.repeat(60);
			const result = (fileManager as any).sanitizeTitle(longTitle);
			expect(result.length).toBe(50);
		});

		it('should return Untitled for empty string', () => {
			const result = (fileManager as any).sanitizeTitle('');
			expect(result).toBe('Untitled');
		});

		it('should handle Chinese characters', () => {
			const result = (fileManager as any).sanitizeTitle('上海旅游攻略');
			expect(result).toBe('上海旅游攻略');
		});

		it('should handle mixed content with hashtag', () => {
			const result = (fileManager as any).sanitizeTitle('北京美食攻略#test');
			expect(result).toBe('北京美食攻略-test');
		});

		it('should remove multiple consecutive hyphens', () => {
			const result = (fileManager as any).sanitizeTitle('Test---Title');
			expect(result).toBe('Test-Title');
		});

		it('should remove parentheses', () => {
			const result = (fileManager as any).sanitizeTitle('Test (Title) Example');
			expect(result).toBe('Test-Title-Example');
		});

		it('should handle Chinese parentheses', () => {
			const result = (fileManager as any).sanitizeTitle('标题（带括号）内容');
			expect(result).toBe('标题-带括号-内容');
		});

		it('should handle mixed special characters', () => {
			const result = (fileManager as any).sanitizeTitle('Test: <Title> (Example) "Quote"');
			expect(result).toBe('Test-Title-Example-Quote');
		});
	});

	describe('getShortId', () => {
		it('should return first 6 characters of id', () => {
			const result = (fileManager as any).getShortId('abc123def456');
			expect(result).toBe('abc123');
		});

		it('should return unknown for empty id', () => {
			const result = (fileManager as any).getShortId('');
			expect(result).toBe('unknown');
		});

		it('should return unknown for null/undefined', () => {
			const result1 = (fileManager as any).getShortId(null as any);
			const result2 = (fileManager as any).getShortId(undefined as any);
			expect(result1).toBe('unknown');
			expect(result2).toBe('unknown');
		});

		it('should handle short id', () => {
			const result = (fileManager as any).getShortId('abc');
			expect(result).toBe('abc');
		});
	});

	describe('generateMarkdown', () => {
		const createMockNote = (overrides: Partial<XHSNote> = {}): XHSNote => ({
			title: 'Test Title',
			content: 'Test content #tag1 #tag2',
			url: 'https://www.xiaohongshu.com/explore/abc123',
			images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
			videos: [],
			tags: ['tag1', 'tag2'],
			isVideo: false,
			rawHtml: '',
			id: 'abc123def456',
			...overrides,
		});

		it('should generate markdown with frontmatter', () => {
			const note = createMockNote();
			const result = (fileManager as any).generateMarkdown(note, false, '/tmp/media');

			expect(result).toContain('---');
			expect(result).toContain('title: Test Title');
			expect(result).toContain('source: https://www.xiaohongshu.com/explore/abc123');
			expect(result).toContain('type: image');
			expect(result).toContain('tags: ["tag1", "tag2"]');
		});

		it('should include cover image when downloadMedia is true', () => {
			const note = createMockNote();
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media');

			expect(result).toContain('cover:');
			expect(result).toContain('../media/');
		});

		it('should use original image URLs when downloadMedia is false', () => {
			const note = createMockNote();
			const result = (fileManager as any).generateMarkdown(note, false, '/tmp/media');

			expect(result).toContain('https://example.com/image1.jpg');
		});

		it('should handle video notes', () => {
			const note = createMockNote({
				isVideo: true,
				videos: ['https://example.com/video.mp4'],
			});
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media');

			expect(result).toContain('type: video');
			expect(result).toContain('<video');
		});

		it('should use S3 URLs when useS3Urls is true', () => {
			const note = createMockNote();
			const s3UrlMap = {
				'Test-Title-abc123-0.jpg': 'https://s3.example.com/image.jpg',
			};
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media', true, s3UrlMap);

			expect(result).toContain('https://s3.example.com/image.jpg');
		});

		it('should handle notes without images', () => {
			const note = createMockNote({ images: [] });
			const result = (fileManager as any).generateMarkdown(note, false, '/tmp/media');

			expect(result).not.toContain('cover:');
		});

		it('should handle notes without tags', () => {
			const note = createMockNote({ tags: [] });
			const result = (fileManager as any).generateMarkdown(note, false, '/tmp/media');

			expect(result).not.toContain('tags:');
		});

		it('should remove hashtags from content', () => {
			const note = createMockNote({ content: 'Content with #hashtag and more text #tag2' });
			const result = (fileManager as any).generateMarkdown(note, false, '/tmp/media');

			expect(result).toContain('Content with');
			expect(result).not.toContain('#hashtag');
		});

		it('should add [V] prefix for video notes in filename generation', () => {
			const note = createMockNote({ isVideo: true });
			const result = (fileManager as any).generateMarkdown(note, false, '/tmp/media');

			expect(result).toContain('type: video');
		});

		it('should generate correct image filename with parentheses in title', () => {
			const note = createMockNote({
				title: '上海美食(必吃)',
				id: 'abc123',
			});
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media');
			expect(result).toContain('上海美食-必吃-abc123-0.jpg');
		});

		it('should generate correct video filename with parentheses', () => {
			const note = createMockNote({
				isVideo: true,
				videos: ['https://example.com/video.mp4'],
				title: '教程(入门篇)',
				id: 'def456',
			});
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media');
			expect(result).toContain('教程-入门篇-def456-video-0.mp4');
		});

		it('should correctly map filenames with special characters to S3 URLs', () => {
			const note = createMockNote({
				title: 'Test (Title)',
				id: 'xyz789',
			});
			const s3UrlMap = {
				'Test-Title-xyz789-0.jpg': 'https://s3.example.com/test (title).jpg',
			};
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media', true, s3UrlMap);
			expect(result).toContain('https://s3.example.com/test (title).jpg');
		});

		it('should handle cover image with special character title', () => {
			const note = createMockNote({
				title: '美食推荐(2024)',
				images: ['https://example.com/cover.jpg'],
				id: 'cover1',
			});
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media');
			expect(result).toContain('cover:');
			expect(result).toContain('美食推荐-2024-cover1-0.jpg');
		});

		it('should handle multiple images with sanitized filenames', () => {
			const note = createMockNote({
				title: '旅行(上海)',
				images: ['https://example.com/1.jpg', 'https://example.com/2.jpg', 'https://example.com/3.jpg'],
				id: 'multi1',
			});
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media');
			expect(result).toContain('旅行-上海-multi1-0.jpg');
			expect(result).toContain('旅行-上海-multi1-1.jpg');
			expect(result).toContain('旅行-上海-multi1-2.jpg');
		});

		it('should handle title with multiple parentheses', () => {
			const note = createMockNote({
				title: '攻略(第一版)(2024)',
				id: 'paren1',
			});
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media');
			expect(result).toContain('攻略-第一版-2024-paren1-0.jpg');
		});

		it('should generate correct cover URL path format', () => {
			const note = createMockNote({
				title: 'Test Note',
				id: 'cover001',
			});
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media');
			expect(result).toMatch(/cover: \.\.\/media\/.+\.jpg/);
		});

		it('should handle title with angle brackets', () => {
			const note = createMockNote({
				title: '<推荐>美食',
				id: 'angle123',
			});
			const result = (fileManager as any).generateMarkdown(note, true, '/tmp/media');
			expect(result).toContain('推荐-美食-angle1');
		});
	});

	describe('getBasePath', () => {
		it('should return base path', () => {
			expect(fileManager.getBasePath()).toBe('/tmp/test');
		});
	});

	describe('getFullBasePath', () => {
		it('should return full path with base folder', () => {
			expect(fileManager.getFullBasePath()).toBe('/tmp/test/XHS Notes');
		});
	});
});
