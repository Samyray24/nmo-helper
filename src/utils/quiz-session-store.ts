import {storageGet} from '../api/storage';
import {questionFingerprint} from './question-fingerprint';
import type {IAnswerCacheMetadata} from './answer-cache';

const STORAGE_KEY = 'nmoQuizSessionsV1';
export const QUIZ_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PROCESSED_RETRY_DELAY_MS = 30_000;

export interface IStoredQuizAnswer extends IAnswerCacheMetadata {
	readonly topic: string;
	readonly question: string;
	readonly variants: string[];
	readonly answers: string[];
	readonly confidence: number;
	readonly updatedAt: number;
	readonly processedAt?: number;
}

interface IQuizSessionState {
	readonly version: 1;
	readonly entries: Record<string, IStoredQuizAnswer>;
}

const EMPTY_STATE: IQuizSessionState = {version: 1, entries: {}};

export class QuizSessionStore {
	private statePromise: Promise<IQuizSessionState> | null = null;

	public async restoreQuestion(topic: string, question: string, variants: string[], now = Date.now()): Promise<IStoredQuizAnswer | null> {
		const state = await this.load();
		const key = questionFingerprint(topic, question, variants);
		const entry = state.entries[key];
		if (!entry || now - entry.updatedAt > QUIZ_SESSION_TTL_MS) return null;
		return cloneEntry(entry);
	}

	public async saveAnswer(input: Omit<IStoredQuizAnswer, 'updatedAt'>, now = Date.now()): Promise<void> {
		const state = await this.load();
		const key = questionFingerprint(input.topic, input.question, input.variants);
		await this.replace({...state.entries, [key]: {...input, variants: [...input.variants], answers: [...input.answers], updatedAt: now}});
	}

	public async markProcessed(topic: string, question: string, variants: string[], now = Date.now()): Promise<void> {
		const state = await this.load();
		const key = questionFingerprint(topic, question, variants);
		const entry = state.entries[key];
		if (!entry) return;
		await this.replace({...state.entries, [key]: {...entry, processedAt: now, updatedAt: now}});
	}

	public async wasProcessedRecently(topic: string, question: string, variants: string[], now = Date.now()): Promise<boolean> {
		const entry = await this.restoreQuestion(topic, question, variants, now);
		return !!entry?.processedAt && now - entry.processedAt < PROCESSED_RETRY_DELAY_MS;
	}

	public async complete(topic: string): Promise<void> {
		const state = await this.load();
		const normalized = normalizeTopic(topic);
		await this.replace(Object.fromEntries(Object.entries(state.entries)
			.filter(([, entry]) => normalizeTopic(entry.topic) !== normalized)));
	}

	public async prune(now = Date.now()): Promise<number> {
		const state = await this.load();
		const entries = Object.fromEntries(Object.entries(state.entries)
			.filter(([, entry]) => now - entry.updatedAt <= QUIZ_SESSION_TTL_MS));
		const removed = Object.keys(state.entries).length - Object.keys(entries).length;
		if (removed) await this.replace(entries);
		return removed;
	}

	/** Сбрасывает только внутренний кеш чтения; используется тестами и после внешнего импорта. */
	public reset(): void {
		this.statePromise = null;
	}

	private load(): Promise<IQuizSessionState> {
		if (!this.statePromise) this.statePromise = storageGet<unknown>(STORAGE_KEY, EMPTY_STATE).then(normalizeState);
		return this.statePromise;
	}

	private async replace(entries: Record<string, IStoredQuizAnswer>): Promise<void> {
		const next: IQuizSessionState = {version: 1, entries};
		await storageWrite(STORAGE_KEY, next);
		this.statePromise = Promise.resolve(next);
	}
}

export const quizSessionStore = new QuizSessionStore();

function normalizeState(value: unknown): IQuizSessionState {
	if (!value || typeof value !== 'object') return EMPTY_STATE;
	const candidate = value as Partial<IQuizSessionState>;
	if (candidate.version !== 1 || !candidate.entries || typeof candidate.entries !== 'object') return EMPTY_STATE;
	return {version: 1, entries: candidate.entries};
}

function cloneEntry(entry: IStoredQuizAnswer): IStoredQuizAnswer {
	return {...entry, variants: [...entry.variants], answers: [...entry.answers]};
}

function normalizeTopic(value: string): string {
	return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru-RU');
}

function storageWrite(key: string, value: unknown): Promise<void> {
	return new Promise(resolve => {
		try {
			chrome.storage.local.set({[key]: value}, () => {
				try { void chrome.runtime.lastError; } catch { /* stale extension context */ }
				resolve();
			});
		} catch {
			resolve();
		}
	});
}
