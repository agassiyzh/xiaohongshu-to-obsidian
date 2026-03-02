import { ImportHistory, ImportRecord } from './import-history';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('ImportHistory', () => {
	let tempDir: string;
	let history: ImportHistory;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xhs-test-'));
		history = new ImportHistory(tempDir);
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	describe('addRecord', () => {
		it('should add a new record', async () => {
			const record: ImportRecord = {
				id: 'test123',
				title: 'Test Note',
				url: 'https://example.com',
				category: '旅行',
				filePath: '/path/to/note.md',
				importedAt: new Date().toISOString(),
				tags: ['tag1'],
				isVideo: false,
			};

			await history.addRecord(record);

			expect(history.hasImported('test123')).toBe(true);
			expect(history.getRecordsCount()).toBe(1);
		});

		it('should overwrite existing record with same id', async () => {
			const record1: ImportRecord = {
				id: 'test123',
				title: 'Original Title',
				url: 'https://example.com',
				category: '旅行',
				filePath: '/path/to/note.md',
				importedAt: new Date().toISOString(),
				tags: ['tag1'],
				isVideo: false,
			};

			const record2: ImportRecord = {
				...record1,
				title: 'Updated Title',
			};

			await history.addRecord(record1);
			await history.addRecord(record2);

			const retrieved = history.getRecord('test123');
			expect(retrieved?.title).toBe('Updated Title');
			expect(history.getRecordsCount()).toBe(1);
		});
	});

	describe('hasImported', () => {
		it('should return false for non-existent record', async () => {
			expect(history.hasImported('nonexistent')).toBe(false);
		});

		it('should return true for existing record', async () => {
			const record: ImportRecord = {
				id: 'test123',
				title: 'Test Note',
				url: 'https://example.com',
				category: '旅行',
				filePath: '/path/to/note.md',
				importedAt: new Date().toISOString(),
				tags: [],
				isVideo: false,
			};

			await history.addRecord(record);

			expect(history.hasImported('test123')).toBe(true);
		});
	});

	describe('getRecord', () => {
		it('should return undefined for non-existent record', () => {
			expect(history.getRecord('nonexistent')).toBeUndefined();
		});

		it('should return the record if exists', async () => {
			const record: ImportRecord = {
				id: 'test123',
				title: 'Test Note',
				url: 'https://example.com',
				category: '美食',
				filePath: '/path/to/note.md',
				importedAt: new Date().toISOString(),
				tags: ['美食', '攻略'],
				isVideo: false,
			};

			await history.addRecord(record);

			const retrieved = history.getRecord('test123');
			expect(retrieved).toEqual(record);
		});
	});

	describe('getAllRecords', () => {
		it('should return empty array when no records', () => {
			expect(history.getAllRecords()).toEqual([]);
		});

		it('should return all records', async () => {
			const record1: ImportRecord = {
				id: 'test1',
				title: 'Note 1',
				url: 'https://example.com/1',
				category: '美食',
				filePath: '/path/1.md',
				importedAt: new Date().toISOString(),
				tags: [],
				isVideo: false,
			};

			const record2: ImportRecord = {
				id: 'test2',
				title: 'Note 2',
				url: 'https://example.com/2',
				category: '旅行',
				filePath: '/path/2.md',
				importedAt: new Date().toISOString(),
				tags: [],
				isVideo: true,
			};

			await history.addRecord(record1);
			await history.addRecord(record2);

			const records = history.getAllRecords();
			expect(records).toHaveLength(2);
		});
	});

	describe('getRecordsByCategory', () => {
		it('should return records filtered by category', async () => {
			const record1: ImportRecord = {
				id: 'test1',
				title: 'Note 1',
				url: 'https://example.com/1',
				category: '美食',
				filePath: '/path/1.md',
				importedAt: new Date().toISOString(),
				tags: [],
				isVideo: false,
			};

			const record2: ImportRecord = {
				id: 'test2',
				title: 'Note 2',
				url: 'https://example.com/2',
				category: '旅行',
				filePath: '/path/2.md',
				importedAt: new Date().toISOString(),
				tags: [],
				isVideo: false,
			};

			await history.addRecord(record1);
			await history.addRecord(record2);

			const foodRecords = history.getRecordsByCategory('美食');
			expect(foodRecords).toHaveLength(1);
			expect(foodRecords[0].title).toBe('Note 1');
		});
	});

	describe('removeRecord', () => {
		it('should remove a record', async () => {
			const record: ImportRecord = {
				id: 'test123',
				title: 'Test Note',
				url: 'https://example.com',
				category: '旅行',
				filePath: '/path/to/note.md',
				importedAt: new Date().toISOString(),
				tags: [],
				isVideo: false,
			};

			await history.addRecord(record);
			expect(history.hasImported('test123')).toBe(true);

			await history.removeRecord('test123');
			expect(history.hasImported('test123')).toBe(false);
		});
	});

	describe('loadHistory and saveHistory', () => {
		it('should persist records to disk', async () => {
			const record: ImportRecord = {
				id: 'test123',
				title: 'Test Note',
				url: 'https://example.com',
				category: '美食',
				filePath: '/path/to/note.md',
				importedAt: new Date().toISOString(),
				tags: ['tag1'],
				isVideo: false,
			};

			await history.addRecord(record);

			// Create new instance to test persistence
			const newHistory = new ImportHistory(tempDir);
			await newHistory.loadHistory();

			expect(newHistory.hasImported('test123')).toBe(true);
			expect(newHistory.getRecord('test123')?.title).toBe('Test Note');
		});

		it('should handle missing history file', async () => {
			// Should not throw
			await history.loadHistory();
			expect(history.getRecordsCount()).toBe(0);
		});
	});

	describe('clearHistory', () => {
		it('should clear all records', async () => {
			const record: ImportRecord = {
				id: 'test123',
				title: 'Test Note',
				url: 'https://example.com',
				category: '旅行',
				filePath: '/path/to/note.md',
				importedAt: new Date().toISOString(),
				tags: [],
				isVideo: false,
			};

			await history.addRecord(record);
			expect(history.getRecordsCount()).toBe(1);

			await history.clearHistory();
			expect(history.getRecordsCount()).toBe(0);
		});
	});

	describe('getStatistics', () => {
		it('should return correct statistics', async () => {
			const record1: ImportRecord = {
				id: 'test1',
				title: 'Note 1',
				url: 'https://example.com/1',
				category: '美食',
				filePath: '/path/1.md',
				importedAt: '2024-01-01T10:00:00.000Z',
				tags: [],
				isVideo: false,
			};

			const record2: ImportRecord = {
				id: 'test2',
				title: 'Note 2',
				url: 'https://example.com/2',
				category: '美食',
				filePath: '/path/2.md',
				importedAt: '2024-01-02T10:00:00.000Z',
				tags: [],
				isVideo: true,
			};

			const record3: ImportRecord = {
				id: 'test3',
				title: 'Note 3',
				url: 'https://example.com/3',
				category: '旅行',
				filePath: '/path/3.md',
				importedAt: '2024-01-03T10:00:00.000Z',
				tags: [],
				isVideo: false,
			};

			await history.addRecord(record1);
			await history.addRecord(record2);
			await history.addRecord(record3);

			const stats = history.getStatistics();

			expect(stats.total).toBe(3);
			expect(stats.byCategory['美食']).toBe(2);
			expect(stats.byCategory['旅行']).toBe(1);
			expect(stats.images).toBe(2);
			expect(stats.videos).toBe(1);
			expect(stats.recentImports).toHaveLength(3);
		});
	});

	describe('exportHistory', () => {
		it('should export history to CSV', async () => {
			const record: ImportRecord = {
				id: 'test123',
				title: 'Test Note',
				url: 'https://example.com',
				category: '美食',
				filePath: '/path/to/note.md',
				importedAt: '2024-01-01T10:00:00.000Z',
				tags: ['tag1', 'tag2'],
				isVideo: false,
			};

			await history.addRecord(record);

			const exportPath = path.join(tempDir, 'export.csv');
			await history.exportHistory(exportPath);

			const content = await fs.readFile(exportPath, 'utf-8');
			expect(content).toContain('ID,Title,URL,Category,FilePath,ImportedAt,Type,Tags');
			expect(content).toContain('test123');
			expect(content).toContain('Test Note');
		});

		it('should escape quotes in title', async () => {
			const record: ImportRecord = {
				id: 'test123',
				title: 'Test "quoted" Title',
				url: 'https://example.com',
				category: '美食',
				filePath: '/path/to/note.md',
				importedAt: '2024-01-01T10:00:00.000Z',
				tags: ['tag1'],
				isVideo: false,
			};

			await history.addRecord(record);

			const exportPath = path.join(tempDir, 'export.csv');
			await history.exportHistory(exportPath);

			const content = await fs.readFile(exportPath, 'utf-8');
			expect(content).toContain('""quoted""');
		});
	});

	describe('importHistory', () => {
		it('should import history from JSON file', async () => {
			const records: ImportRecord[] = [
				{
					id: 'import1',
					title: 'Imported Note 1',
					url: 'https://example.com/1',
					category: '美食',
					filePath: '/path/1.md',
					importedAt: '2024-01-01T10:00:00.000Z',
					tags: [],
					isVideo: false,
				},
				{
					id: 'import2',
					title: 'Imported Note 2',
					url: 'https://example.com/2',
					category: '旅行',
					filePath: '/path/2.md',
					importedAt: '2024-01-02T10:00:00.000Z',
					tags: [],
					isVideo: false,
				},
			];

			const importPath = path.join(tempDir, 'import.json');
			await fs.writeFile(importPath, JSON.stringify(records));

			await history.importHistory(importPath);

			expect(history.getRecordsCount()).toBe(2);
			expect(history.hasImported('import1')).toBe(true);
			expect(history.hasImported('import2')).toBe(true);
		});

		it('should merge without duplicates', async () => {
			const existingRecord: ImportRecord = {
				id: 'existing',
				title: 'Existing Note',
				url: 'https://example.com/1',
				category: '美食',
				filePath: '/path/1.md',
				importedAt: '2024-01-01T10:00:00.000Z',
				tags: [],
				isVideo: false,
			};

			await history.addRecord(existingRecord);

			const importRecords: ImportRecord[] = [
				{
					id: 'existing',
					title: 'Should Not Overwrite',
					url: 'https://example.com/2',
					category: '旅行',
					filePath: '/path/2.md',
					importedAt: '2024-01-02T10:00:00.000Z',
					tags: [],
					isVideo: false,
				},
				{
					id: 'new',
					title: 'New Note',
					url: 'https://example.com/3',
					category: '知识',
					filePath: '/path/3.md',
					importedAt: '2024-01-03T10:00:00.000Z',
					tags: [],
					isVideo: false,
				},
			];

			const importPath = path.join(tempDir, 'import.json');
			await fs.writeFile(importPath, JSON.stringify(importRecords));

			await history.importHistory(importPath);

			expect(history.getRecordsCount()).toBe(2);
			expect(history.getRecord('existing')?.title).toBe('Existing Note'); // Should not be overwritten
		});
	});
});
