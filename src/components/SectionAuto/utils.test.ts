import {describe, expect, it} from 'vitest';
import {resolveAnswerConsensus} from './utils';

const match = (source: string, answers: string[], score = 0.9) => ({source, found: {answers, score}});

describe('resolveAnswerConsensus', () => {
	it('выбирает ответ, который подтвердили два источника против одного', () => {
		const first = match('A', ['Верно']);
		const second = match('B', ['верно']);
		const conflicting = match('C', ['Неверно'], 0.95);

		const result = resolveAnswerConsensus([conflicting, first, second], 0.7);

		expect(result.kind).toBe('answer');
		if (result.kind === 'answer') {
			expect(result.selected.found.answers).toEqual(['Верно']);
			expect(result.support).toHaveLength(2);
		}
	});

	it('блокирует автоматический выбор при равенстве надёжных источников', () => {
		const result = resolveAnswerConsensus([
			match('A', ['Первый']),
			match('B', ['Второй']),
		], 0.7);

		expect(result.kind).toBe('conflict');
	});

	it('игнорирует слабый конфликт', () => {
		const result = resolveAnswerConsensus([
			match('A', ['Верно'], 0.92),
			match('B', ['Неверно'], 0.3),
		], 0.7);

		expect(result.kind).toBe('answer');
		if (result.kind === 'answer') expect(result.selected.source).toBe('A');
	});
});
