import {SELECTORS} from './constants';

export type DomProfileName = 'current-material' | 'compatible' | 'unknown';

export interface IDomProfile {
	readonly name: DomProfileName;
	readonly selectors: Readonly<Record<'topic' | 'questionAnchor' | 'questionText' | 'variant', string | null>>;
	readonly missing: readonly string[];
}

/** Detects which supported NMO layout is visible without collecting page text. */
export function detectDomProfile(root: ParentNode = document): IDomProfile {
	const topic = matchSelector(root, SELECTORS.topic);
	const questionAnchor = matchSelector(root, SELECTORS.questionAnchor);
	const anchor = questionAnchor.selector ? root.querySelector(questionAnchor.selector) : null;
	const questionText = matchSelector(anchor ?? root, SELECTORS.questionText);
	const variant = matchSelector(anchor ?? root, SELECTORS.variant);
	const matched = {topic: topic.selector, questionAnchor: questionAnchor.selector, questionText: questionText.selector, variant: variant.selector};
	const missing = Object.entries(matched).filter(([, value]) => !value).map(([key]) => key);
	const indexes = [topic.index, questionAnchor.index, questionText.index, variant.index];
	return {
		name: missing.length ? 'unknown' : indexes.every(index => index === 0) ? 'current-material' : 'compatible',
		selectors: matched,
		missing,
	};
}

function matchSelector(root: ParentNode, selectors: readonly string[]): {selector: string | null; index: number} {
	for (let index = 0; index < selectors.length; index += 1) {
		if (root.querySelector(selectors[index])) return {selector: selectors[index], index};
	}
	return {selector: null, index: -1};
}
