import {beforeEach, describe, expect, it} from 'vitest';
import {localAnswerDb} from './local-answer-db';

beforeEach(() => localAnswerDb.clear());

describe('localAnswerDb', () => {
	it('заменяет и находит локальные ответы', async () => {
		await localAnswerDb.replace([{topic: 'T', question: 'Q', variants: ['A', 'B'], answers: ['B']}]);
		expect(await localAnswerDb.find('T', 'Q', ['B', 'A'])).toMatchObject({answers: ['B']});
	});

	it('объединяет базу и дедуплицирует неизвестные вопросы', async () => {
		await localAnswerDb.merge([{topic: 'T', question: 'Q1', variants: ['A', 'B'], answers: ['A']}]);
		await localAnswerDb.merge([{topic: 'T', question: 'Q2', variants: ['A', 'B'], answers: ['B']}]);
		await localAnswerDb.addUnknown({topic: 'T', question: 'Q3', variants: ['A', 'B']});
		await localAnswerDb.addUnknown({topic: 'T', question: 'Q3', variants: ['A', 'B']});
		expect((await localAnswerDb.stats()).answers).toBe(2);
		expect((await localAnswerDb.listUnknown())).toHaveLength(1);
	});
});
