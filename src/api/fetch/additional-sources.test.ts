import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ADDITIONAL_SOURCES} from '../../utils/constants';
import {fetchViaBackground} from './fetch';
import {clearAdditionalSourceCaches, findAdditionalAnswer, getAdditionalAnswers, searchAdditionalSource} from './additional-sources';

vi.mock('./fetch', async importOriginal => ({
	...await importOriginal<typeof import('./fetch')>(), fetchViaBackground: vi.fn(),
}));
const mockFetch = vi.mocked(fetchViaBackground);
const ok = (text: string) => ({error: false, status: 200, text});
const page = (question = 'Какой вариант подходит?') => `<div class="entry-content"><h3>1. ${question}</h3><p>1) Первый;<br>2) Второй; +</p></div>`;
const searchPage = (path: string) => `<article><h2 class="entry-title"><a href="${path}">Тест НМО с ответами: Тема</a></h2></article>`;
const isSearchRequest = (url: string) => {
	const u = new URL(url);
	return u.searchParams.has('s') || u.pathname === '/api/test-search';
};
beforeEach(() => { mockFetch.mockReset(); clearAdditionalSourceCaches(); });

describe('Запросы новых баз', () => {
	it.each(ADDITIONAL_SOURCES)('ищет на $host через публичную форму без cookies', async source => {
		mockFetch.mockImplementation(async url => {
			if (source.key === 'medstandartprof' && new URL(url).pathname === '/api/test-search') {
				return ok(JSON.stringify({
					docs: [{title: 'Тест НМО с ответами: Тема', uri: 'test/test-responses/test.html'}],
				}));
			}
			return ok(searchPage('/test'));
		});
		const results = await searchAdditionalSource('  Тема & вопрос  ', source.key);
		const [url, options] = mockFetch.mock.calls[0];
		const parsedUrl = new URL(url);
		expect(parsedUrl.hostname).toBe(source.host);
		expect(parsedUrl.searchParams.get(source.key === 'medstandartprof' ? 'q' : 's')).toBe('Тема & вопрос');
		expect(options).toMatchObject({credentials: 'omit', timeoutMs: 15000});
		expect(results).toEqual([{
			source: source.key,
			title: 'Тест НМО с ответами: Тема',
			url: source.key === 'medstandartprof'
				? `https://${source.host}/test/test-responses/test.html`
				: `https://${source.host}/test`,
		}]);
	});

	it('повторный поиск не запрашивает сайт снова и не отдаёт изменяемый кеш', async () => {
		mockFetch.mockResolvedValue(ok(searchPage('/test')));
		const first = await searchAdditionalSource('Тема', 'otvnmo');
		first.pop();
		expect(await searchAdditionalSource('Тема', 'otvnmo')).toHaveLength(1);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('не кеширует ошибки и повторяет неудачный запрос', async () => {
		mockFetch.mockResolvedValueOnce({error: false, status: 503, text: searchPage('/test')}).mockResolvedValueOnce(ok(searchPage('/test')));
		await expect(searchAdditionalSource('Тема', 'otvnmo')).rejects.toThrow();
		expect(await searchAdditionalSource('Тема', 'otvnmo')).toHaveLength(1);
	});

	it('загружает все варианты и ответы с поддерживаемой страницы', async () => {
		mockFetch.mockResolvedValue(ok(page()));
		expect(await getAdditionalAnswers('https://otvnmo.ru/test')).toEqual([
			{question: 'Какой вариант подходит?', variants: ['Первый', 'Второй'], answers: ['Второй'], idx: 0},
		]);
		await getAdditionalAnswers('https://otvnmo.ru/test');
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('не делает запрос по адресу вне новых баз', async () => {
		await expect(getAdditionalAnswers('https://other.example/test')).rejects.toThrow();
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe('Автоматический резервный поиск', () => {
	it('после неудачного поиска темы ищет сам вопрос и переживает ошибку другого сайта', async () => {
		mockFetch.mockImplementation(async url => {
			const u = new URL(url);
			if (u.hostname === 'reshtestnmo.ru') return {error: true, status: 0, text: ''};
			const query = u.searchParams.get('s') ?? u.searchParams.get('q');
			if (query === 'Тема') return ok(u.pathname === '/api/test-search' ? '{"docs":[]}' : 'нет результатов');
			if (isSearchRequest(url)) return ok(u.hostname === 'otvnmo.ru' ? searchPage('/test') : '');
			return ok(page());
		});
		const result = await findAdditionalAnswer('Тема', 'Какой вариант подходит?', ['Первый', 'Второй']);
		expect(result).toMatchObject({url: 'https://otvnmo.ru/test', source: 'otvnmo', match: {answers: ['Второй'], score: 1}});
		expect(mockFetch.mock.calls.some(([url]) => {
			const u = new URL(url);
			return (u.searchParams.get('s') ?? u.searchParams.get('q')) === 'Какой вариант подходит?';
		})).toBe(true);
	});

	it('найдя подходящий ответ по теме, не запускает второй поиск', async () => {
		mockFetch.mockImplementation(async url => ok(isSearchRequest(url) ? searchPage('/test') : page()));
		expect((await findAdditionalAnswer('Тема', 'Какой вариант подходит?', ['Первый', 'Второй']))?.match.answers).toEqual(['Второй']);
		expect(mockFetch.mock.calls.filter(([url]) => isSearchRequest(url))).toHaveLength(ADDITIONAL_SOURCES.length);
	});

	it('при отмене не загружает страницы и не возвращает устаревший ответ', async () => {
		mockFetch.mockResolvedValue(ok(searchPage('/test')));
		expect(await findAdditionalAnswer('Тема', 'Какой вариант подходит?', ['Первый', 'Второй'], () => true)).toBeNull();
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('не угадывает ответ, если подходящего вопроса в новых базах нет', async () => {
		mockFetch.mockImplementation(async url => ok(isSearchRequest(url) ? searchPage('/test') : page('Чужой вопрос')));
		expect(await findAdditionalAnswer('Тема', 'Какой вариант подходит?', ['Первый', 'Второй'])).toBeNull();
	});

	it('не принимает несколько отмеченных ответов для вопроса с одним выбором', async () => {
		mockFetch.mockImplementation(async url => ok(isSearchRequest(url) ? searchPage('/test') : page().replace('1) Первый;', '1) Первый; +')));
		expect(await findAdditionalAnswer('Тема', 'Какой вариант подходит?', ['Первый', 'Второй'], () => false, true)).toBeNull();
	});
});
