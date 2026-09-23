import {strFromU8, unzipSync} from 'fflate';
import type {ILocalAnswerRecord, IUnknownQuestionRecord} from './local-answer-db';

export interface ILocalBaseExport {
	readonly schemaVersion: 1;
	readonly exportedAt: string;
	readonly records: ILocalAnswerRecord[];
}

export function parseJsonBase(text: string): ILocalAnswerRecord[] {
	let payload: unknown;
	try { payload = JSON.parse(text); } catch { throw new Error('JSON повреждён'); }
	if (!isRecord(payload) || payload.schemaVersion !== 1) throw new Error('неподдерживаемая версия схемы');
	if (!Array.isArray(payload.records)) throw new Error('в JSON отсутствует массив records');
	return payload.records.map((record, index) => validateRecord(record, index + 1));
}

export function parseCsvBase(text: string): ILocalAnswerRecord[] {
	const rows = parseCsvRows(text.replace(/^\uFEFF/, ''));
	if (rows.length < 2) throw new Error('CSV не содержит записей');
	const headers = rows[0].map(value => value.trim().toLowerCase());
	const required = ['topic', 'question', 'variants', 'answers'];
	for (const name of required) if (!headers.includes(name)) throw new Error(`CSV: нет колонки ${name}`);
	return rows.slice(1).filter(row => row.some(Boolean)).map((row, index) => validateRecord({
		topic: row[headers.indexOf('topic')],
		question: row[headers.indexOf('question')],
		variants: splitList(row[headers.indexOf('variants')]),
		answers: splitList(row[headers.indexOf('answers')]),
	}, index + 2));
}

export async function parseLocalBaseFile(file: File): Promise<ILocalAnswerRecord[]> {
	if (file.size > 20 * 1024 * 1024) throw new Error('Файл больше 20 МБ');
	const name = file.name.toLowerCase();
	if (name.endsWith('.json')) return parseJsonBase(await file.text());
	if (name.endsWith('.csv')) return parseCsvBase(await file.text());
	if (!name.endsWith('.zip')) throw new Error('поддерживаются только JSON, CSV и ZIP');
	let uncompressedSize = 0;
	const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {filter: entry => {
		uncompressedSize += entry.originalSize;
		if (uncompressedSize > 20 * 1024 * 1024) throw new Error('Распакованный ZIP больше 20 МБ');
		return true;
	}});
	const supported = Object.entries(entries).filter(([entry]) => /\.(json|csv)$/i.test(entry) && !entry.includes('__MACOSX'));
	if (supported.length !== 1) throw new Error('ZIP должен содержать ровно один JSON или CSV');
	const [entryName, bytes] = supported[0];
	const text = strFromU8(bytes);
	return entryName.toLowerCase().endsWith('.json') ? parseJsonBase(text) : parseCsvBase(text);
}

export function serializeLocalBase(records: readonly ILocalAnswerRecord[]): string {
	const payload: ILocalBaseExport = {schemaVersion: 1, exportedAt: new Date().toISOString(), records: records.map(record => ({...record, variants: [...record.variants], answers: [...record.answers]}))};
	return JSON.stringify(payload, null, 2);
}

export function serializeUnknownQuestions(records: readonly IUnknownQuestionRecord[]): string {
	return JSON.stringify({schemaVersion: 1, exportedAt: new Date().toISOString(), unknown: records}, null, 2);
}

function validateRecord(value: unknown, line: number): ILocalAnswerRecord {
	if (!isRecord(value)) throw new Error(`запись ${line}: ожидается объект`);
	const topic = stringValue(value.topic);
	const question = stringValue(value.question);
	const variants = stringArray(value.variants);
	const answers = stringArray(value.answers);
	if (!question || variants.length < 2 || !answers.length) throw new Error(`запись ${line}: неполные данные`);
	if (answers.some(answer => !variants.some(variant => normalize(variant) === normalize(answer)))) throw new Error(`запись ${line}: ответ отсутствует среди вариантов`);
	const metadata: Partial<ILocalAnswerRecord> = {
		...(typeof value.source === 'string' ? {source: value.source.slice(0, 200)} : {}),
		...(typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? {updatedAt: value.updatedAt} : {}),
	};
	const conflicts = Array.isArray(value.conflicts) ? value.conflicts.map(stringArray) : [];
	if (conflicts.some(group => !group.length || group.some(answer => !variants.includes(answer)))) throw new Error(`запись ${line}: неверные конфликтующие ответы`);
	return {topic, question, variants, answers, ...metadata, ...(conflicts.length ? {conflicts} : {})};
}

function parseCsvRows(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [], value = '', quoted = false;
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
		else if (char === '"') quoted = !quoted;
		else if (char === ',' && !quoted) { row.push(value); value = ''; }
		else if ((char === '\n' || char === '\r') && !quoted) {
			if (char === '\r' && text[index + 1] === '\n') index += 1;
			row.push(value); rows.push(row); row = []; value = '';
		} else value += char;
	}
	if (value || row.length) { row.push(value); rows.push(row); }
	if (quoted) throw new Error('CSV: незакрытая кавычка');
	return rows;
}

function splitList(value: string): string[] {
	const trimmed = value?.trim() ?? '';
	if (!trimmed) return [];
	if (trimmed.startsWith('[')) {
		try { return stringArray(JSON.parse(trimmed)); } catch { throw new Error('CSV: некорректный список'); }
	}
	return trimmed.split('|').map(item => item.trim()).filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
function stringValue(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean) : []; }
function normalize(value: string): string { return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru-RU'); }
