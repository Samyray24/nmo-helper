import type {AdditionalSourceKey, ISearchResult} from '../../types';
import type {IParse2Result, QaCaseModel} from '../../utils/cases';
import {findAnswers} from '../../utils/cases';
import {ADDITIONAL_SOURCES, LOW_CONFIDENCE_THRESHOLD} from '../../utils/constants';
import {extractAdditionalCases, isAdditionalSource, parseAdditionalSearchResults} from '../../utils/additional-sources';
import {detectSource, stripAnswerTitlePrefix, variantScore} from '../../utils/matching';
import {fetchViaBackground, getResponseText, mapWithConcurrency} from './fetch';

export interface IAdditionalAnswer {
	readonly source: AdditionalSourceKey;
	readonly url: string;
	readonly model: QaCaseModel[];
	readonly match: IParse2Result;
}
interface ICacheEntry<T> {readonly expiresAt: number; readonly data: Promise<T[]>}
const searchCache = new Map<string, ICacheEntry<ISearchResult>>();
const pageCache = new Map<string, ICacheEntry<QaCaseModel>>();
const REQUEST_OPTIONS = {credentials: 'omit' as const, timeoutMs: 15000};

export function clearAdditionalSourceCaches(): void {
	searchCache.clear();
	pageCache.clear();
}

/** Использует штатную публичную форму поиска сайта. */
export async function searchAdditionalSource(query: string, source: AdditionalSourceKey): Promise<ISearchResult[]> {
	const normalized = query.trim().replace(/\s+/g, ' ');
	if (!normalized) return [];
	const config = ADDITIONAL_SOURCES.find(item => item.key === source)!;
	const url = new URL(`https://${config.host}/`);
	url.searchParams.set('s', normalized);
	const results = await cachedLoad(searchCache, url.href, 4 * 60 * 1000, 60, async () => {
		const response = await fetchViaBackground(url.href, REQUEST_OPTIONS);
		return parseAdditionalSearchResults(getResponseText(response), source);
	});
	return results.map(result => ({...result}));
}

export async function getAdditionalAnswers(url: string): Promise<QaCaseModel[]> {
	const source = detectSource(url);
	if (!source || !isAdditionalSource(source)) throw new Error('URL не относится к дополнительной базе');
	const results = await cachedLoad(pageCache, url, 10 * 60 * 1000, 30, async () => {
		const response = await fetchViaBackground(url, REQUEST_OPTIONS);
		return extractAdditionalCases(getResponseText(response), source);
	});
	return results.map(item => ({...item, variants: [...item.variants], answers: [...item.answers]}));
}

/** Ищет сначала тему, затем вопрос. Ошибка отдельного сайта не останавливает остальные. */
export async function findAdditionalAnswer(topic: string | null, question: string, variants: string[], cancelled: () => boolean = () => false, isSingle = false): Promise<IAdditionalAnswer | null> {
	if (!question || !variants.length || cancelled()) return null;
	const queries = [...new Set([topic, question].filter((q): q is string => !!q?.trim()).map(q => q.trim()))];
	const visited = new Set<string>();
	let best: IAdditionalAnswer | null = null;
	for (const query of queries) {
		if (cancelled()) return null;
		const groups = await Promise.all(ADDITIONAL_SOURCES.map(async source => {
			try {
				const results = await searchAdditionalSource(query, source.key);
				return results.sort((a, b) => variantScore(stripAnswerTitlePrefix(b.title), query) - variantScore(stripAnswerTitlePrefix(a.title), query)).slice(0, 3);
			} catch { return []; }
		}));
		if (cancelled()) return null;
		const candidates = groups.flat().filter(result => {
			if (visited.has(result.url)) return false;
			visited.add(result.url);
			return true;
		});
		const loaded = await mapWithConcurrency(candidates, 6, async result => {
			if (cancelled()) return null;
			try {
				const model = await getAdditionalAnswers(result.url);
				if (cancelled()) return null;
				const match = findAnswers(model, question, variants);
				if (isSingle && match?.answers.length !== 1) return null;
				return match?.answers.length ? {source: result.source as AdditionalSourceKey, url: result.url, model, match} : null;
			} catch { return null; }
		});
		if (cancelled()) return null;
		for (const answer of loaded) {
			if (answer && (!best || answer.match.score > best.match.score)) best = answer;
		}
		if (best && best.match.score >= LOW_CONFIDENCE_THRESHOLD) return best;
	}
	return best;
}

async function cachedLoad<T>(cache: Map<string, ICacheEntry<T>>, key: string, ttlMs: number, limit: number, load: () => Promise<T[]>): Promise<T[]> {
	const previous = cache.get(key);
	if (previous && previous.expiresAt > Date.now()) {
		cache.delete(key);
		cache.set(key, previous);
		return previous.data;
	}
	const entry = {expiresAt: Date.now() + ttlMs, data: load()};
	cache.set(key, entry);
	while (cache.size > limit) cache.delete(cache.keys().next().value!);
	try { return await entry.data; } catch (error) {
		if (cache.get(key) === entry) cache.delete(key);
		throw error;
	}
}
