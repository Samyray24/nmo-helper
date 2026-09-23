import {localAnswerDb} from './local-answer-db';
import {parseJsonBase} from './local-base-import';

// Credentials, custom URLs and diagnostic logs are deliberately excluded.
const SETTINGS: Record<string, (value: unknown) => boolean> = {
	panelTheme: value => value === 'light' || value === 'dark',
	panelCollapsed: value => typeof value === 'boolean',
	mode: value => ['sites', 'ai', 'auto', 'pdf', 'base'].includes(String(value)),
	confidenceThreshold: value => typeof value === 'number' && value >= 0 && value <= 1,
	autoSolveDelayMinSeconds: value => typeof value === 'number' && value >= 5 && value <= 300,
	autoSolveDelayMaxSeconds: value => typeof value === 'number' && value >= 5 && value <= 300,
	quizRecoveryEnabled: value => typeof value === 'boolean',
};

export async function createBackup(): Promise<string> {
	const settings = await new Promise<Record<string, unknown>>((resolve, reject) => {
		chrome.storage.local.get(Object.keys(SETTINGS), result => chrome.runtime.lastError ? reject(new Error('Не удалось прочитать настройки')) : resolve(result));
	});
	return JSON.stringify({kind: 'nmo-helper-backup', schemaVersion: 1, exportedAt: new Date().toISOString(), settings, records: await localAnswerDb.listAnswers(), unknown: await localAnswerDb.listUnknown()}, null, 2);
}

export async function restoreBackup(text: string): Promise<void> {
	const data = JSON.parse(text) as Record<string, unknown>;
	if (!data || data.kind !== 'nmo-helper-backup' || data.schemaVersion !== 1) throw new Error('Неверный формат резервной копии');
	const records = parseJsonBase(text);
	const settings: Record<string, unknown> = {autoSolveTests: false, autoSolveMode: 'highlight'};
	if (!data.settings || typeof data.settings !== 'object') throw new Error('Нет настроек в резервной копии');
	for (const [key, value] of Object.entries(data.settings)) {
		if (Object.prototype.hasOwnProperty.call(SETTINGS, key)) { if (!SETTINGS[key](value)) throw new Error(`Неверная настройка: ${key}`); settings[key] = value; }
	}
	if (!Array.isArray(data.unknown) || data.unknown.some(item => !item || typeof item.topic !== 'string' || typeof item.question !== 'string' || !Array.isArray(item.variants) || item.variants.some((v: unknown) => typeof v !== 'string'))) throw new Error('Неверные неизвестные вопросы');
	await localAnswerDb.merge(records);
	for (const item of data.unknown) await localAnswerDb.addUnknown({topic: item.topic, question: item.question, variants: item.variants});
	await new Promise<void>((resolve, reject) => chrome.storage.local.set(settings, () => chrome.runtime.lastError ? reject(new Error('Не удалось восстановить настройки')) : resolve()));
}
