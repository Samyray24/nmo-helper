import {Status} from '../../types';
import type {IToast} from '../ui/InlineToast';

export function statusToToast(title: string, status: typeof Status[keyof typeof Status]): IToast {
	if (status === Status.OK)   return {kind: 'success', title};
	if (status === Status.ERR)  return {kind: 'danger',  title};
	return {kind: 'warning', title};
}

export interface IAnswerMatch {
	readonly found: {
		readonly answers: readonly string[];
		readonly score: number;
	};
}

export type IConsensusResult<T extends IAnswerMatch> =
	| {readonly kind: 'answer'; readonly selected: T; readonly support: readonly T[]}
	| {readonly kind: 'conflict'; readonly matches: readonly T[]}
	| {readonly kind: 'none'};

const normalizeAnswerSet = (answers: readonly string[]): string => [...answers]
	.map(answer => answer.trim().toLocaleLowerCase('ru-RU'))
	.sort()
	.join('\n');

/** Выбирает ответ по строгому большинству надёжных источников. */
export function resolveAnswerConsensus<T extends IAnswerMatch>(matches: readonly T[], threshold: number): IConsensusResult<T> {
	if (!matches.length) return {kind: 'none'};

	const reliable = matches.filter(match => match.found.score >= threshold);
	if (!reliable.length) return {kind: 'answer', selected: matches[0], support: [matches[0]]};

	const groups = new Map<string, T[]>();
	for (const match of reliable) {
		const key = normalizeAnswerSet(match.found.answers);
		groups.set(key, [...(groups.get(key) ?? []), match]);
	}

	const ranked = [...groups.values()].sort((a, b) =>
		b.length - a.length || b[0].found.score - a[0].found.score);
	const winner = ranked[0];
	const runnerUp = ranked[1];

	if (!runnerUp || (winner.length >= 2 && winner.length > runnerUp.length)) {
		return {kind: 'answer', selected: winner[0], support: winner};
	}

	return {kind: 'conflict', matches: reliable};
}
