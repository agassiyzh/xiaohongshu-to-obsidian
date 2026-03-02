import { XHSImporter } from './xhs-importer';

describe('XHSImporter', () => {
	let importer: XHSImporter;

	beforeEach(() => {
		importer = new XHSImporter();
	});

	describe('extractURL', () => {
		it('should extract xhslink.com URL with proper format', () => {
			const shareText = '来看看这个笔记 http://xhslink.com/a/abc123';
			const result = importer.extractURL(shareText);
			expect(result).toBe('http://xhslink.com/a/abc123');
		});

		it('should extract xhslink.com URL with a prefix', () => {
			const shareText = '来看看这个笔记 http://xhslink.com/a/abc123';
			const result = importer.extractURL(shareText);
			expect(result).toBe('http://xhslink.com/a/abc123');
		});

		it('should extract xhslink.com URL with o prefix', () => {
			const shareText = '来看看这个笔记 http://xhslink.com/o/abc123';
			const result = importer.extractURL(shareText);
			expect(result).toBe('http://xhslink.com/o/abc123');
		});

		it('should extract xiaohongshu.com explore URL', () => {
			const shareText = '来看看这个笔记 https://www.xiaohongshu.com/explore/abc123';
			const result = importer.extractURL(shareText);
			expect(result).toBe('https://www.xiaohongshu.com/explore/abc123');
		});

		it('should return null for invalid URL', () => {
			const shareText = 'No URL here';
			const result = importer.extractURL(shareText);
			expect(result).toBeNull();
		});

		it('should handle Chinese comma', () => {
			// eslint-disable-next-line no-irregular-whitespace
			const shareText = '来看看这个笔记 https://www.xiaohongshu.com/explore/abc123，写的真好';
			const result = importer.extractURL(shareText);
			expect(result).toBe('https://www.xiaohongshu.com/explore/abc123');
		});

		it('should handle regular comma', () => {
			const shareText = '来看看这个笔记 https://www.xiaohongshu.com/explore/abc123,写的真好';
			const result = importer.extractURL(shareText);
			expect(result).toBe('https://www.xiaohongshu.com/explore/abc123');
		});

		it('should extract first URL when multiple present', () => {
			const shareText = 'https://www.xiaohongshu.com/explore/abc123 https://www.xiaohongshu.com/explore/def456';
			const result = importer.extractURL(shareText);
			expect(result).toBe('https://www.xiaohongshu.com/explore/abc123');
		});
	});

	describe('extractNoteIdFromUrl', () => {
		it('should extract note ID from URL', () => {
			const url = 'https://www.xiaohongshu.com/explore/abc123def456';
			const result = importer.extractNoteIdFromUrl(url);
			expect(result).toBe('abc123def456');
		});

		it('should return null for invalid URL', () => {
			const url = 'https://www.xiaohongshu.com/user/profile/123';
			const result = importer.extractNoteIdFromUrl(url);
			expect(result).toBeNull();
		});
	});

	describe('sanitizeFilename', () => {
		it('should remove special characters', () => {
			const result = importer.sanitizeFilename('Test: <Title> with "quotes"');
			expect(result).toBe('Test-Title-with-quotes');
		});

		it('should handle Chinese characters', () => {
			const result = importer.sanitizeFilename('上海旅游攻略');
			expect(result).toBe('上海旅游攻略');
		});

		it('should replace spaces with hyphens', () => {
			const result = importer.sanitizeFilename('Test Title With Spaces');
			expect(result).toBe('Test-Title-With-Spaces');
		});

		it('should truncate to 50 characters', () => {
			const longTitle = 'A'.repeat(60);
			const result = importer.sanitizeFilename(longTitle);
			expect(result.length).toBe(50);
		});

		it('should return Untitled for empty string', () => {
			const result = importer.sanitizeFilename('');
			expect(result).toBe('Untitled');
		});

		it('should keep alphanumeric, Chinese, spaces, hyphens and underscores', () => {
			const result = importer.sanitizeFilename('Test_123-中文内容');
			expect(result).toBe('Test_123-中文内容');
		});
	});

	describe('extractNoteId', () => {
		it('should extract note ID from URL in HTML', () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<body>
				https://www.xiaohongshu.com/explore/abc123def456
				</body>
				</html>
			`;
			const result = importer.extractNoteId(html);
			expect(result).toBe('abc123def456');
		});

		it('should extract note ID from initial state', () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<head></head>
				<body>
				<script>
				window.__INITIAL_STATE__={"note":{"noteDetailMap":{"xyz789":{"note":{"desc":"test"}}}}}</script>
				</body>
				</html>
			`;
			const result = importer.extractNoteId(html);
			expect(result).toBe('xyz789');
		});

		it('should fallback to timestamp when no ID found', () => {
			const html = '<html><body>No ID here</body></html>';
			const result = importer.extractNoteId(html);
			expect(result).toBeDefined();
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe('HTML parsing methods', () => {
		const createMockHtml = (title: string, content: string, images: string[] = [], isVideo: boolean = false) => {
			const noteType = isVideo ? 'video' : 'normal';
			const imageList = images.map(url => `{"urlDefault":"${url}","height":1000,"width":1000}`).join(',');
			return `
				<!DOCTYPE html>
				<html>
				<head><title>${title} - 小红书</title></head>
				<body>
				<div id="detail-desc" class="desc">${content}</div>
				<script>
				window.__INITIAL_STATE__={"note":{"noteDetailMap":{"abc123":{"note":{"desc":"${content}","type":"${noteType}","imageList":[${imageList}]}}}}}</script>
				</body>
				</html>
			`;
		};

		describe('extractTitle', () => {
			it('should extract title from HTML', () => {
				const html = '<!DOCTYPE html><html><head><title>Test Title - 小红书</title></head><body></body></html>';
				const result = (importer as any).extractTitle(html);
				expect(result).toBe('Test Title');
			});

			it('should return default title when not found', () => {
				const html = '<!DOCTYPE html><html><body></body></html>';
				const result = (importer as any).extractTitle(html);
				expect(result).toBe('Untitled Xiaohongshu Note');
			});
		});

		describe('extractTags', () => {
			it('should extract tags from content', () => {
				const content = 'This is content #tag1 #tag2 #美食';
				const result = (importer as any).extractTags(content);
				expect(result).toEqual(['tag1', 'tag2', '美食']);
			});

			it('should return empty array when no tags', () => {
				const content = 'This is content without tags';
				const result = (importer as any).extractTags(content);
				expect(result).toEqual([]);
			});
		});

		describe('extractContent', () => {
		it('should extract content from detail-desc div', () => {
			const html = '<!DOCTYPE html><html><body><div id="detail-desc" class="desc">Test content</div></body></html>';
			const result = (importer as any).extractContent(html);
			expect(result).toBe('Test content');
		});

		it('should clean up topic brackets', () => {
			const html = '<!DOCTYPE html><html><body><div id="detail-desc" class="desc">[话题]测试内容[其他]</div></body></html>';
			const result = (importer as any).extractContent(html);
			expect(result).toBe('测试内容');
		});
		});

		describe('extractImages', () => {
			it('should extract image URLs from initial state', () => {
				const html = createMockHtml('Test', 'Content', ['https://example.com/img1.jpg', 'https://example.com/img2.jpg']);
				const result = (importer as any).extractImages(html);
				expect(result).toEqual(['https://example.com/img1.jpg', 'https://example.com/img2.jpg']);
			});

			it('should return empty array when no images', () => {
				const html = createMockHtml('Test', 'Content', []);
				const result = (importer as any).extractImages(html);
				expect(result).toEqual([]);
			});

			it('should filter out non-http URLs', () => {
				const html = createMockHtml('Test', 'Content', ['data://image.jpg', 'https://example.com/img.jpg']);
				const result = (importer as any).extractImages(html);
				expect(result).toEqual(['https://example.com/img.jpg']);
			});
		});

		describe('isVideoNote', () => {
			it('should return true for video notes', () => {
				const html = createMockHtml('Test', 'Content', [], true);
				const result = (importer as any).isVideoNote(html);
				expect(result).toBe(true);
			});

			it('should return false for image notes', () => {
				const html = createMockHtml('Test', 'Content', [], false);
				const result = (importer as any).isVideoNote(html);
				expect(result).toBe(false);
			});
		});
	});
});
