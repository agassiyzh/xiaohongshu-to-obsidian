import fs from 'fs/promises';
import path from 'path';

export interface ImportRecord {
	id: string;
	title: string;
	url: string;
	category: string;
	filePath: string;
	importedAt: string;
	tags: string[];
	isVideo: boolean;
}

export class ImportHistory {
	private historyPath: string;
	private records: Map<string, ImportRecord> = new Map();

	constructor(baseFolder: string) {
		this.historyPath = path.join(baseFolder, '.import-history.json');
	}

	async loadHistory(): Promise<void> {
		try {
			const data = await fs.readFile(this.historyPath, 'utf-8');
			const records = JSON.parse(data) as ImportRecord[];
			this.records.clear();
			records.forEach(record => {
				this.records.set(record.id, record);
			});
		} catch (error) {
			if ((error as any).code === 'ENOENT') {
				// File doesn't exist, start with empty history
				this.records.clear();
			} else {
				throw error;
			}
		}
	}

	async saveHistory(): Promise<void> {
		const records = Array.from(this.records.values());
		await fs.writeFile(this.historyPath, JSON.stringify(records, null, 2), 'utf-8');
	}

	async addRecord(record: ImportRecord): Promise<void> {
		this.records.set(record.id, record);
		await this.saveHistory();
	}

	async removeRecord(noteId: string): Promise<void> {
		this.records.delete(noteId);
		await this.saveHistory();
	}

	hasImported(noteId: string): boolean {
		return this.records.has(noteId);
	}

	getRecord(noteId: string): ImportRecord | undefined {
		return this.records.get(noteId);
	}

	getAllRecords(): ImportRecord[] {
		return Array.from(this.records.values());
	}

	getRecordsByCategory(category: string): ImportRecord[] {
		return Array.from(this.records.values()).filter(record => record.category === category);
	}

	getRecordsCount(): number {
		return this.records.size;
	}

	async clearHistory(): Promise<void> {
		this.records.clear();
		await this.saveHistory();
	}

	// 获取导入统计信息
	getStatistics(): {
		total: number;
		byCategory: { [category: string]: number };
		videos: number;
		images: number;
		recentImports: ImportRecord[];
	} {
		const records = this.getAllRecords();
		const byCategory: { [category: string]: number } = {};
		let videos = 0;
		let images = 0;

		records.forEach(record => {
			byCategory[record.category] = (byCategory[record.category] || 0) + 1;
			if (record.isVideo) {
				videos++;
			} else {
				images++;
			}
		});

		// 最近10条导入记录
		const recentImports = records
			.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())
			.slice(0, 10);

		return {
			total: records.length,
			byCategory,
			videos,
			images,
			recentImports
		};
	}

	// 导出历史记录
	async exportHistory(filePath: string): Promise<void> {
		const records = this.getAllRecords();
		const csvHeader = 'ID,Title,URL,Category,FilePath,ImportedAt,Type,Tags\n';
		const csvRows = records.map(record => [
			record.id,
			`"${record.title.replace(/"/g, '""')}"`, // Escape quotes in title
			record.url,
			record.category,
			record.filePath,
			record.importedAt,
			record.isVideo ? 'Video' : 'Image',
			`"${record.tags.join(';')}"`
		].join(','));

		const csvContent = csvHeader + csvRows.join('\n');
		await fs.writeFile(filePath, csvContent, 'utf-8');
	}

	// 导入历史记录（合并模式）
	async importHistory(filePath: string): Promise<void> {
		try {
			const data = await fs.readFile(filePath, 'utf-8');
			const records = JSON.parse(data) as ImportRecord[];

			for (const record of records) {
				if (!this.hasImported(record.id)) {
					this.records.set(record.id, record);
				}
			}

			await this.saveHistory();
		} catch (error) {
			throw new Error(`Failed to import history from ${filePath}: ${(error as Error).message}`);
		}
	}
}
