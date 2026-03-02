import { AIClassifier } from './ai-classifier';
import { XHSNote } from './types';

describe('AIClassifier', () => {
	describe('keywordBasedCategorize', () => {
		const createMockNote = (overrides: Partial<XHSNote> = {}): XHSNote => ({
			title: 'Test Title',
			content: 'Test content',
			url: 'https://example.com',
			images: [],
			videos: [],
			tags: [],
			isVideo: false,
			rawHtml: '',
			id: 'test123',
			...overrides,
		});

		const categories = ['美食', '旅行', '娱乐', '知识', '工作', '情感', '个人成长', '优惠', '搞笑', '育儿', '其他'];

		it('should categorize food content', () => {
			const note = createMockNote({
				title: '美食推荐',
				content: '这家餐厅太好吃了，口感很棒，料理正宗',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('美食');
		});

		it('should categorize travel content', () => {
			const note = createMockNote({
				title: '旅行攻略',
				content: '上海旅游必去景点，酒店预订，机票攻略',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('旅行');
		});

		it('should categorize entertainment content', () => {
			const note = createMockNote({
				title: '电影推荐',
				content: '最新电视剧，综艺节目，游戏音乐',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('娱乐');
		});

		it('should categorize knowledge content', () => {
			const note = createMockNote({
				title: '学习教程',
				content: '分享知识，技能教程，学习方法与技巧',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('知识');
		});

		it('should categorize work content', () => {
			const note = createMockNote({
				title: '职场分享',
				content: '工作面试，简历投递，薪资待遇，公司氛围',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('工作');
		});

		it('should categorize emotion content', () => {
			const note = createMockNote({
				title: '情感分享',
				content: '恋爱心得，情感问题，夫妻关系',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('情感');
		});

		it('should categorize personal growth content', () => {
			const note = createMockNote({
				title: '自我提升',
				content: '个人成长，习惯养成，时间管理，目标计划',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('个人成长');
		});

		it('should categorize deal content', () => {
			const note = createMockNote({
				title: '购物指南',
				content: '打折活动，限时特卖，大甩卖，购物便宜商品',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('优惠');
		});

		it('should categorize humor content', () => {
			const note = createMockNote({
				title: '搞笑段子',
				content: '有趣的故事，幽默笑话，开心一刻',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('搞笑');
		});

		it('should categorize parenting content', () => {
			const note = createMockNote({
				title: '育儿经验',
				content: '孩子教育心得，新手妈妈爸爸分享亲子活动',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('育儿');
		});

		it('should return 其他 when no keywords match', () => {
			const note = createMockNote({
				title: 'Random Title',
				content: 'Some random content that does not match any category',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('其他');
		});

		it('should match tags as well as content', () => {
			const note = createMockNote({
				title: 'Random Title',
				content: 'Some content',
				tags: ['美食', '餐厅'],
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('美食');
		});

		it('should only return categories that exist in the provided list', () => {
			const note = createMockNote({
				title: '美食推荐',
				content: '好吃',
			});
			const limitedCategories = ['美食', '旅行'];
			const result = AIClassifier.keywordBasedCategorize(note, limitedCategories);
			expect(result).toBe('美食');
		});

		it('should return 其他 when matched category not in list', () => {
			const note = createMockNote({
				title: '美食推荐',
				content: '好吃',
			});
			const limitedCategories = ['旅行', '娱乐'];
			const result = AIClassifier.keywordBasedCategorize(note, limitedCategories);
			expect(result).toBe('其他');
		});

		it('should be case insensitive', () => {
			const note = createMockNote({
				title: '美食推荐',
				content: '好吃',
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('美食');
		});

		it('should handle empty categories list', () => {
			const note = createMockNote({
				title: '美食推荐',
				content: '好吃',
			});
			const result = AIClassifier.keywordBasedCategorize(note, []);
			expect(result).toBe('其他');
		});

		it('should handle empty note', () => {
			const note = createMockNote({
				title: '',
				content: '',
				tags: [],
			});
			const result = AIClassifier.keywordBasedCategorize(note, categories);
			expect(result).toBe('其他');
		});
	});
});
