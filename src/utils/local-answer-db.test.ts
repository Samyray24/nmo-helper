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

it('сохраняет противоречие до ручного разрешения', async () => {
	const record = {topic: 'T', question: 'Q', variants: ['A', 'B'], answers: ['A']};
	await localAnswerDb.merge([record]);
	await localAnswerDb.merge([{...record, answers: ['B']}]);
	expect((await localAnswerDb.find('T', 'Q', ['A', 'B']))?.conflicts).toEqual([['A'], ['B']]);
	await localAnswerDb.merge([{...record, answers: ['B'], conflicts: []}], true);
	expect((await localAnswerDb.find('T', 'Q', ['A', 'B']))?.conflicts).toEqual([]);
});

it('выявляет противоречия внутри заменяющего файла', async () => {
	const record = {topic: 'T', question: 'Q', variants: ['A', 'B'], answers: ['A']};
	await localAnswerDb.replace([record, {...record, answers: ['B']}]);
	expect((await localAnswerDb.find('T', 'Q', ['A', 'B']))?.conflicts).toHaveLength(2);
});
