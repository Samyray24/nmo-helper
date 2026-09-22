import {beforeEach, describe, expect, it} from 'vitest';
import {PROCESSED_RETRY_DELAY_MS, QUIZ_SESSION_TTL_MS, QuizSessionStore} from './quiz-session-store';

const answer = {
	topic: 'Тест', question: 'Вопрос', variants: ['A', 'B'], answers: ['A'], confidence: 0.95,
	source: 'local', reason: 'Локальная база', supportCount: 1,
};

beforeEach(async () => {
	await new Promise<void>(resolve => chrome.storage.local.set({nmoQuizSessionsV1: {version: 1, entries: {}}}, () => resolve()));
});

describe('QuizSessionStore', () => {
	it('восстанавливает сохранённый ответ', async () => {
		const store = new QuizSessionStore();
		await store.saveAnswer(answer, 1_000_000);
		expect(await store.restoreQuestion('Тест', 'Вопрос', ['B', 'A'], 1_000_100)).toMatchObject({answers: ['A'], source: 'local'});
	});

	it('удаляет записи старше семи дней', async () => {
		const store = new QuizSessionStore();
		await store.saveAnswer(answer, 1_000_000);
		expect(await store.prune(1_000_000 + QUIZ_SESSION_TTL_MS + 1)).toBe(1);
		expect(await store.restoreQuestion('Тест', 'Вопрос', ['A', 'B'], 1_000_000 + QUIZ_SESSION_TTL_MS + 1)).toBeNull();
	});

	it('защищает от повторного клика только в течение короткого окна', async () => {
		const store = new QuizSessionStore();
		await store.saveAnswer(answer, 1_000_000);
		await store.markProcessed('Тест', 'Вопрос', ['A', 'B'], 1_001_000);
		expect(await store.wasProcessedRecently('Тест', 'Вопрос', ['A', 'B'], 1_001_100)).toBe(true);
		expect(await store.wasProcessedRecently('Тест', 'Вопрос', ['A', 'B'], 1_001_000 + PROCESSED_RETRY_DELAY_MS + 1)).toBe(false);
	});

	it('очищает только завершённую тему', async () => {
		const store = new QuizSessionStore();
		await store.saveAnswer(answer);
		await store.saveAnswer({...answer, topic: 'Другой тест'});
		await store.complete('Тест');
		expect(await store.restoreQuestion('Тест', 'Вопрос', ['A', 'B'])).toBeNull();
		expect(await store.restoreQuestion('Другой тест', 'Вопрос', ['A', 'B'])).not.toBeNull();
	});
});
