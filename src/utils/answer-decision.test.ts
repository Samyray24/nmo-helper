import {describe, expect, it} from 'vitest';
import {resolveAnswerDecision, type AnswerCandidate} from './answer-decision';

const candidate = (source: string, answers: string[], score: number): AnswerCandidate => ({
	source,
	label: source,
	url: `https://${source}.example`,
	answers,
	score,
});

describe('resolveAnswerDecision', () => {
	it('выбирает ответ, подтверждённый большинством источников', () => {
		const result = resolveAnswerDecision([
			candidate('first', ['A'], 0.94),
			candidate('second', ['a'], 0.91),
			candidate('third', ['B'], 0.96),
		], 0.8);

		expect(result).toMatchObject({kind: 'confirmed', answers: ['A'], supportCount: 2});
		if (result.kind === 'confirmed') expect(result.reason).toContain('Совпали 2 источника');
	});

	it('блокирует равный конфликт надёжных источников', () => {
		expect(resolveAnswerDecision([
			candidate('first', ['A'], 0.94),
			candidate('second', ['B'], 0.94),
		], 0.8).kind).toBe('conflict');
	});

	it('отделяет слабый ответ от подтверждённого', () => {
		const result = resolveAnswerDecision([candidate('first', ['A'], 0.52)], 0.8);
		expect(result).toMatchObject({kind: 'low-confidence'});
	});

	it('сообщает об отсутствии кандидатов', () => {
		expect(resolveAnswerDecision([], 0.8)).toEqual({kind: 'not-found', reason: 'Подходящих ответов нет'});
	});
});
