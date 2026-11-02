import type {AdditionalSourceKey, ISourceKey, ISearchResult} from '../types';
import type {QaCaseModel} from './cases';
import {ADDITIONAL_SOURCES} from './constants';
import {parseHtml} from './html';
export {ADDITIONAL_SOURCES} from './constants';

const QUESTION_HEADING_RE = /^(?:Вопрос\s*(?:№\s*)?)?\d+\.\s+(.+)/iu;
const RIGHT_ANSWER_SUFFIX_RE = /\s*[—–-]\s*верный\s+ответ\s*$/iu;
const HIGHLIGHT_SPAN_STYLE_RE = /(?:^|;)\s*(?:color\s*:\s*(?:#(?:008080|008000|339966|1b5e20|2e7d32|0f5132|009900|00a650)\b|rgb\(\s*(?:0\s*,\s*128\s*,\s*128|0\s*,\s*128\s*,\s*0|51\s*,\s*153\s*,\s*102)\s*\))|background(?:-color)?\s*:\s*#(?!fff(?:fff)?\b)[0-9a-f]{3,6}\b)/i;

export function isAdditionalSource(source: ISourceKey | null): source is AdditionalSourceKey {
	return ADDITIONAL_SOURCES.some(item => item.key === source);
}

/** Формирует публичный поисковый URL для выбранной дополнительной базы. */
export function buildAdditionalSearchUrl(query: string, source: AdditionalSourceKey): string {
	const config = ADDITIONAL_SOURCES.find(item => item.key === source)!;
	if (source === 'medstandartprof') {
		const url = new URL(`https://${config.host}/api/test-search`);
		url.searchParams.set('prefix', 'test/test-responses/');
		url.searchParams.set('q', query);
		url.searchParams.set('limit', '10');
		return url.href;
	}
	const url = new URL(`https://${config.host}/`);
	url.searchParams.set('s', query);
	return url.href;
}

/** Читает заголовки статей WordPress или JSON-ответ поиска и оставляет ссылки только выбранной базы. */
export function parseAdditionalSearchResults(raw: string, source: AdditionalSourceKey): ISearchResult[] {
	const config = ADDITIONAL_SOURCES.find(item => item.key === source)!;
	const seen = new Set<string>();

	if (source === 'medstandartprof' && raw.trimStart().startsWith('{')) {
		return parseMedstandartprofSearchJson(raw, config.host, seen);
	}

	return [...parseHtml(raw).querySelectorAll('.entry-title a, .post-card__title a, h2 a, h3 a')].flatMap(link => {
		if (link.closest('aside, nav, footer, .widget, .menu')) return [];
		const href = link.getAttribute('href');
		const title = link.textContent?.replace(/\s+/g, ' ').trim();
		if (!href || !title || !/нмо|тест|ответ/iu.test(title)) return [];
		let url: URL;
		try { url = new URL(href, `https://${config.host}`); } catch { return []; }
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return [];
		if (url.hostname !== config.host && url.hostname !== `www.${config.host}`) return [];
		if (url.pathname === '/' || /^\/(?:category|tag|author|page)\//.test(url.pathname)) return [];
		url.hash = '';
		if (seen.has(url.href)) return [];
		seen.add(url.href);
		return [{source, title, url: url.href}];
	});
}

function parseMedstandartprofSearchJson(raw: string, host: string, seen: Set<string>): ISearchResult[] {
	let parsed: unknown;
	try { parsed = JSON.parse(raw); } catch { return []; }
	const docs = (parsed as {docs?: unknown})?.docs;
	if (!Array.isArray(docs)) return [];

	return docs.flatMap(doc => {
		const item = doc as {title?: unknown; uri?: unknown};
		const title = typeof item?.title === 'string' ? item.title.replace(/\s+/g, ' ').trim() : '';
		const uri = typeof item?.uri === 'string' ? item.uri.trim() : '';
		if (!title || !uri || !/^\/?test\/test-responses\/[^?#]+$/i.test(uri)) return [];
		let url: URL;
		try { url = new URL(uri.startsWith('/') ? uri : `/${uri}`, `https://${host}`); } catch { return []; }
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return [];
		if (url.hostname !== host && url.hostname !== `www.${host}`) return [];
		url.hash = '';
		if (seen.has(url.href)) return [];
		seen.add(url.href);
		return [{source: 'medstandartprof', title, url: url.href}];
	});
}

/** Извлекает только вопросы с явными отметками ответа; содержимое страницы не вставляется в DOM портала. */
export function extractAdditionalCases(html: string, source: AdditionalSourceKey): QaCaseModel[] {
	const doc = parseHtml(html);

	if (source === 'topquiz') {
		const topquizCases = extractTopquizCases(doc);
		if (topquizCases.length > 0) return topquizCases;
	}

	const content = doc.querySelector('.entry-content, .post-content, .test-content-filterable');
	if (!content) return [];
	content.querySelectorAll('.table-of-contents, #toc_container, .toc, .b-r, .related-posts, .acc-banner, aside, nav, footer, style, script').forEach(el => el.remove());
	const boldAnswers = ADDITIONAL_SOURCES.find(item => item.key === source)?.boldAnswers === true;
	const cases: QaCaseModel[] = [];
	let current: {question: string; variants: string[]; answers: string[]} | null = null;
	const finish = () => {
		if (current?.answers.length && current.variants.length > 1) cases.push({...current, idx: cases.length});
	};
	for (const block of content.querySelectorAll('h2, h3, h4, p, li')) {
		if (block.tagName !== 'LI' && block.closest('li')) continue;
		const isFirstQuestionBlockParagraph = block.tagName === 'P'
			&& block.parentElement?.hasAttribute('data-question-block') === true
			&& block === block.parentElement.querySelector('p');
		for (const line of readLines(block)) {
			const text = line.text.replace(/\s+/g, ' ').trim();
			const heading = block.tagName !== 'LI' ? text.match(QUESTION_HEADING_RE) : null;
			if (heading) {
				finish();
				current = {question: heading[1].trim(), variants: [], answers: []};
				continue;
			}
			if (isFirstQuestionBlockParagraph && text && !/^\d+\)\s*/.test(text)) {
				finish();
				current = {question: text, variants: [], answers: []};
				continue;
			}
			if (!current || (!/^\d+\)\s*/.test(text) && block.tagName !== 'LI')) continue;
			const answer = cleanAdditionalAnswer(text);
			if (!answer) continue;
			const hasPlus = /(?:^|\s|[.;])\+\s*[.;]?\s*$/.test(text);
			const marked = cleanAdditionalAnswer(line.marked);
			const bold = cleanAdditionalAnswer(line.bold);
			const correct = hasPlus || (!!marked && marked === answer) || (boldAnswers && !!bold && bold === answer);
			current.variants.push(answer);
			if (correct) current.answers.push(answer);
		}
	}
	finish();
	return cases;
}

function extractTopquizCases(doc: ParentNode): QaCaseModel[] {
	const quizContainer = doc.querySelector('#nmo-test-container[data-questions]');
	if (quizContainer) {
		try {
			const rawQuestions: unknown = JSON.parse(quizContainer.getAttribute('data-questions') ?? '');
			if (Array.isArray(rawQuestions)) {
				const cases: QaCaseModel[] = [];
				for (const entry of rawQuestions) {
					const item = entry as {question?: unknown; answers?: unknown};
					const rawQ = typeof item?.question === 'string' ? item.question.replace(/\s+/g, ' ').trim() : '';
					const question = rawQ.replace(QUESTION_HEADING_RE, '$1').trim();
					if (!question || !Array.isArray(item?.answers)) continue;
					const variants: string[] = [];
					const answers: string[] = [];
					for (const opt of item.answers) {
						const ansObj = opt as {text?: unknown; correct?: unknown};
						if (typeof ansObj?.text !== 'string') continue;
						const cleaned = cleanAdditionalAnswer(ansObj.text.replace(RIGHT_ANSWER_SUFFIX_RE, ''));
						if (!cleaned) continue;
						variants.push(cleaned);
						if (ansObj.correct === true) answers.push(cleaned);
					}
					if (answers.length > 0 && variants.length > 1) {
						cases.push({question, variants, answers, idx: cases.length});
					}
				}
				if (cases.length > 0) return cases;
			}
		} catch {
			// При повреждённом атрибуте переходим к разбору HTML-карточек.
		}
	}

	const faqItems = doc.querySelectorAll('.tqp-faq-item');
	if (!faqItems.length) return [];
	const cases: QaCaseModel[] = [];
	for (const item of faqItems) {
		const rawQ = item.querySelector('.tqp-faq-q')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
		const question = rawQ.replace(QUESTION_HEADING_RE, '$1').trim();
		if (!question) continue;
		const variants: string[] = [];
		const answers: string[] = [];
		for (const li of item.querySelectorAll('.tqp-faq-opts > li, ul > li, ol > li')) {
			const rawOpt = (li.textContent ?? '').replace(/\s+/g, ' ').trim();
			const withoutBadge = rawOpt.replace(RIGHT_ANSWER_SUFFIX_RE, '');
			const hasPlus = /(?:^|\s|[.;])\+\s*[.;]?\s*$/.test(withoutBadge);
			const cleaned = cleanAdditionalAnswer(withoutBadge);
			if (!cleaned) continue;
			const isCorrect = li.classList.contains('is-right') || hasPlus || Boolean(li.querySelector('mark'));
			variants.push(cleaned);
			if (isCorrect) answers.push(cleaned);
		}
		if (answers.length > 0 && variants.length > 1) {
			cases.push({question, variants, answers, idx: cases.length});
		}
	}
	return cases;
}

interface IAnswerLine {text: string; bold: string; marked: string}

/** Удаляет отдельную отметку ответа, сохраняя знак заряда в Na+ и подобных обозначениях. */
function cleanAdditionalAnswer(text: string): string {
	return text.replace(/\s+/g, ' ').trim().replace(/^\d+\)\s*/, '')
		.replace(/(?:^|\s|[.;])\+\s*[.;]?\s*$/, '').replace(/[.;\s]+$/, '').trim();
}

function isHighlightedSpan(element: Element): boolean {
	if (element.tagName !== 'SPAN') return false;
	const style = element.getAttribute('style') ?? '';
	return Boolean(style) && HIGHLIGHT_SPAN_STYLE_RE.test(style);
}

/** Сохраняет границы br-строк и выделение каждого варианта, включая вложенные span. */
function readLines(element: Element): IAnswerLine[] {
	const lines: IAnswerLine[] = [{text: '', bold: '', marked: ''}];
	const visit = (node: Node, bold = false, marked = false): void => {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent ?? '';
			const line = lines[lines.length - 1];
			line.text += text;
			if (bold) line.bold += text;
			if (marked) line.marked += text;
			return;
		}
		if (!(node instanceof Element)) return;
		if (node.tagName === 'BR') { lines.push({text: '', bold: '', marked: ''}); return; }
		const nextBold = bold || /^(STRONG|B)$/.test(node.tagName);
		const nextMarked = marked || node.tagName === 'MARK' || isHighlightedSpan(node);
		for (const child of node.childNodes) visit(child, nextBold, nextMarked);
	};
	visit(element);
	return lines;
}
