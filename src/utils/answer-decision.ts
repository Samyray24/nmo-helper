export interface AnswerCandidate {
	readonly source: string;
	readonly label: string;
	readonly url: string;
	readonly answers: readonly string[];
	readonly score: number;
}

export type AnswerDecision =
	| {readonly kind: 'confirmed'; readonly answers: string[]; readonly selected: AnswerCandidate; readonly confidence: number; readonly supportCount: number; readonly reason: string; readonly candidates: readonly AnswerCandidate[]}
	| {readonly kind: 'low-confidence'; readonly candidate: AnswerCandidate; readonly reason: string}
	| {readonly kind: 'conflict'; readonly candidates: readonly AnswerCandidate[]; readonly reason: string}
	| {readonly kind: 'not-found'; readonly reason: string};

const answerKey = (answers: readonly string[]): string => [...answers]
	.map(answer => answer.trim().toLocaleLowerCase('ru-RU'))
	.sort()
	.join('\n');

/** Выбирает подтверждённый ответ и формирует понятное объяснение решения. */
export function resolveAnswerDecision(candidates: readonly AnswerCandidate[], threshold: number): AnswerDecision {
	if (!candidates.length) return {kind: 'not-found', reason: 'Подходящих ответов нет'};
	const ranked = [...candidates].sort((a, b) => b.score - a.score);
	const reliable = ranked.filter(candidate => candidate.score >= threshold);
	if (!reliable.length) {
		return {kind: 'low-confidence', candidate: ranked[0], reason: `Точность ${asPercent(ranked[0].score)} ниже порога ${asPercent(threshold)}`};
	}

	const groups = new Map<string, AnswerCandidate[]>();
	for (const candidate of reliable) {
		const key = answerKey(candidate.answers);
		groups.set(key, [...(groups.get(key) ?? []), candidate]);
	}
	const grouped = [...groups.values()].sort((left, right) =>
		right.length - left.length || right[0].score - left[0].score);
	const winner = grouped[0];
	const runnerUp = grouped[1];
	if (runnerUp && (winner.length < 2 || winner.length === runnerUp.length)) {
		return {kind: 'conflict', candidates: reliable, reason: `${grouped.length} группы источников дают разные ответы`};
	}

	const confidence = Math.min(1, Math.max(...winner.map(candidate => candidate.score)) + Math.min(0.06, (winner.length - 1) * 0.03));
	const reason = winner.length > 1
		? `Совпали ${winner.length} источника · ${asPercent(confidence)}`
		: `${winner[0].label} · ${asPercent(confidence)}`;
	return {
		kind: 'confirmed',
		answers: [...winner[0].answers],
		selected: winner[0],
		confidence,
		supportCount: winner.length,
		reason,
		candidates: ranked,
	};
}

function asPercent(value: number): string {
	return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}
