import type {AdditionalSourceKey, ISourceKey, ISearchResult} from '../types';
import type {QaCaseModel} from './cases';
import {ADDITIONAL_SOURCES} from './constants';
import {parseHtml} from './html';
export {ADDITIONAL_SOURCES} from './constants';

export function isAdditionalSource(source: ISourceKey | null): source is AdditionalSourceKey {
	return ADDITIONAL_SOURCES.some(item => item.key === source);
}

/** Читает заголовки статей WordPress и оставляет ссылки только выбранной базы. */
export function parseAdditionalSearchResults(html: string, source: AdditionalSourceKey): ISearchResult[] {
	const config = ADDITIONAL_SOURCES.find(item => item.key === source)!;
	const seen = new Set<string>();
	return [...parseHtml(html).querySelectorAll('.entry-title a, .post-card__title a, h2 a, h3 a')].flatMap(link => {
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

/** Извлекает только вопросы с явными отметками ответа; содержимое страницы не вставляется в DOM портала. */
export function extractAdditionalCases(html: string, source: AdditionalSourceKey): QaCaseModel[] {
	const content = parseHtml(html).querySelector('.entry-content, .post-content');
	if (!content) return [];
	content.querySelectorAll('.table-of-contents, .toc, .b-r, .related-posts, aside, nav, footer').forEach(el => el.remove());
	const boldAnswers = ADDITIONAL_SOURCES.find(item => item.key === source)?.boldAnswers === true;
	const cases: QaCaseModel[] = [];
	let current: {question: string; variants: string[]; answers: string[]} | null = null;
	const finish = () => {
		if (current?.answers.length && current.variants.length > 1) cases.push({...current, idx: cases.length});
	};
	for (const block of content.querySelectorAll('h2, h3, h4, p, li')) {
		if (block.tagName !== 'LI' && block.closest('li')) continue;
		for (const line of readLines(block)) {
			const text = line.text.replace(/\s+/g, ' ').trim();
			const heading = block.tagName !== 'LI' ? text.match(/^\d+\.\s+(.+)/) : null;
			if (heading) {
				finish();
				current = {question: heading[1].trim(), variants: [], answers: []};
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

interface IAnswerLine {text: string; bold: string; marked: string}

/** Удаляет отдельную отметку ответа, сохраняя знак заряда в Na+ и подобных обозначениях. */
function cleanAdditionalAnswer(text: string): string {
	return text.replace(/\s+/g, ' ').trim().replace(/^\d+\)\s*/, '')
		.replace(/(?:^|\s|[.;])\+\s*[.;]?\s*$/, '').replace(/[.;\s]+$/, '').trim();
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
		for (const child of node.childNodes) visit(child, bold || /^(STRONG|B)$/.test(node.tagName), marked || node.tagName === 'MARK');
	};
	visit(element);
	return lines;
}
