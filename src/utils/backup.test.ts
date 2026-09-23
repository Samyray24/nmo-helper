import {beforeEach, describe, expect, it} from 'vitest';
import {createBackup, restoreBackup} from './backup';
import {localAnswerDb} from './local-answer-db';
import {storageGet, storageSet} from '../api/storage';

beforeEach(() => localAnswerDb.clear());
describe('backup', () => {
	it('переносит базу без токенов и отключает автопрохождение при восстановлении', async () => {
		storageSet('apiKey', 'secret'); storageSet('panelTheme', 'light');
		await localAnswerDb.merge([{topic: 'T', question: 'Q', variants: ['A', 'B'], answers: ['B']}]);
		const backup = await createBackup();
		expect(backup).not.toContain('secret');
		await localAnswerDb.clear();
		await restoreBackup(backup);
		expect(await localAnswerDb.find('T', 'Q', ['A', 'B'])).toMatchObject({answers: ['B']});
		expect(await storageGet('autoSolveMode', '')).toBe('highlight');
	});
	it('отклоняет повреждённые данные до изменения базы', async () => {
		await expect(restoreBackup(JSON.stringify({kind: 'nmo-helper-backup', schemaVersion: 1, records: [], unknown: [{}], settings: {}}))).rejects.toThrow();
	});
});
