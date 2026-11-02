import {describe, expect, it} from 'vitest';
import {ADDITIONAL_SOURCES, buildAdditionalSearchUrl, extractAdditionalCases, parseAdditionalSearchResults} from './additional-sources';
import {detectSource} from './matching';

describe('Дополнительные базы НМО', () => {
	it.each([
		'reshtestnmo.ru',
		'otvnmo.ru',
		'test-nmo.ru',
		'pro-nmo.ru',
		'tests-nmo.ru',
		'topquiz.ru',
		'medstandartprof.ru',
		'xn----7sb7afecfbku.xn--p1ai',
		'bogoslavsky.pro',
	])(
		'распознаёт домен %s и извлекает HTML-результаты поиска', host => {
			const source = ADDITIONAL_SOURCES.find(s => s.host === host)!;
			expect(detectSource(`https://${host}/test`)).toBe(source.key);
			const html = `<header><h2><a href="/">Главная</a></h2></header>
			<article><h2 class="entry-title"><a href="/test">Тест НМО с ответами: Тема</a></h2></article>
			<div class="post-card"><div class="entry-title"><a href="/test">Тест НМО с ответами: Тема</a></div></div>
			<article><h2 class="entry-title"><a href="https://other.example/test">Тест НМО с ответами: Чужой</a></h2></article>`;
			expect(parseAdditionalSearchResults(html, source.key)).toEqual([
				{source: source.key, title: 'Тест НМО с ответами: Тема', url: `https://${host}/test`},
			]);
		},
	);

	it('формирует JSON API URL и разбирает ответ поиска medstandartprof', () => {
		const url = buildAdditionalSearchUrl('Артериальная гипертензия', 'medstandartprof');
		const parsed = new URL(url);
		expect(parsed.origin + parsed.pathname).toBe('https://medstandartprof.ru/api/test-search');
		expect(parsed.searchParams.get('prefix')).toBe('test/test-responses/');
		expect(parsed.searchParams.get('q')).toBe('Артериальная гипертензия');

		const json = JSON.stringify({
			docs: [
				{
					id: 48707,
					title: 'Артериальная гипертензия у взрослых (по утвержденным клиническим рекомендациям) - 2024',
					uri: 'test/test-responses/page-3724.html',
				},
				{
					id: 12,
					title: 'Нерелевантный раздел сайта',
					uri: 'blog/article.html',
				},
			],
		});
		expect(parseAdditionalSearchResults(json, 'medstandartprof')).toEqual([
			{
				source: 'medstandartprof',
				title: 'Артериальная гипертензия у взрослых (по утвержденным клиническим рекомендациям) - 2024',
				url: 'https://medstandartprof.ru/test/test-responses/page-3724.html',
			},
		]);
	});

	it('не путает название домена в пути или чужой поддомен с новой базой', () => {
		expect(detectSource('https://example.com/reshtestnmo.ru')).toBeNull();
		expect(detectSource('https://otvnmo.ru.example.com/test')).toBeNull();
		expect(detectSource('https://topquiz.ru.example.com/test')).toBeNull();
	});

	it.each(['reshtestnmo', 'otvnmo', 'test-nmo'] as const)('разбирает вопросы с br и плюсом: %s', source => {
		const html = `<div class="entry-content">
		<div class="table-of-contents"><p>1. Содержание</p></div>
		<h3>1. Какой вариант подходит?</h3><p>1) Первый;<br><strong>2) Второй; +</strong><br>3) Третий.</p>
		<p><strong>2. Какие варианты подходят?</strong></p><p>1) Один; +<br>2) Два;<br>3) Три. +</p>
		<h3>3. Нет отмеченных ответов</h3><p>1) +4+6 градусов;<br>2) Ноль.</p>
		</div><aside><h3>4. Реклама</h3><p>1) Баннер +</p></aside>`;
		expect(extractAdditionalCases(html, source)).toEqual([
			{question: 'Какой вариант подходит?', variants: ['Первый', 'Второй', 'Третий'], answers: ['Второй'], idx: 0},
			{question: 'Какие варианты подходят?', variants: ['Один', 'Два', 'Три'], answers: ['Один', 'Три'], idx: 1},
		]);
	});

	it('читает mark в списках tests-nmo и не теряет варианты без отметки', () => {
		expect(extractAdditionalCases(`<div class="entry-content"><p><strong>1. Вопрос?</strong></p>
		<ol><li><mark>Первый;</mark></li><li>Второй;</li><li><mark>Третий.</mark></li></ol></div>`, 'tests-nmo')).toEqual([
			{question: 'Вопрос?', variants: ['Первый', 'Второй', 'Третий'], answers: ['Первый', 'Третий'], idx: 0},
		]);
	});

	it('читает карточки test-content-filterable базы medstandartprof', () => {
		const html = `<div class="test-content-filterable">
			<div data-question-block="true">
				<p><strong>1. Какой препарат первой линии?</strong></p>
				<ol>
					<li><mark>Ингибитор АПФ;</mark></li>
					<li>Плацебо;</li>
					<li><mark>Блокатор рецепторов ангиотензина.</mark></li>
				</ol>
			</div>
		</div>`;
		expect(extractAdditionalCases(html, 'medstandartprof')).toEqual([
			{
				question: 'Какой препарат первой линии?',
				variants: ['Ингибитор АПФ', 'Плацебо', 'Блокатор рецепторов ангиотензина'],
				answers: ['Ингибитор АПФ', 'Блокатор рецепторов ангиотензина'],
				idx: 0,
			},
		]);
	});

	it('разбирает оба формата topquiz: data-questions JSON и tqp-faq-item', () => {
		const dataJson = JSON.stringify([
			{
				question: '1. Какой метод информативен?',
				answers: [
					{text: 'МРТ головного мозга', correct: true},
					{text: 'Осмотр без приборов', correct: false},
				],
			},
		]).replace(/'/g, '&#39;');
		expect(extractAdditionalCases(`<div id="nmo-test-container" data-questions='${dataJson}'></div>`, 'topquiz')).toEqual([
			{
				question: 'Какой метод информативен?',
				variants: ['МРТ головного мозга', 'Осмотр без приборов'],
				answers: ['МРТ головного мозга'],
				idx: 0,
			},
		]);

		const faqHtml = `<div class="tqp-faq-list">
			<details class="tqp-faq-item">
				<summary><span class="tqp-faq-q">2. Какие симптомы характерны?</span></summary>
				<ul class="tqp-faq-opts">
					<li class="is-right">Лихорадка — верный ответ</li>
					<li>Отсутствие жалоб</li>
					<li class="is-right">Кашель - верный ответ</li>
				</ul>
			</details>
		</div>`;
		expect(extractAdditionalCases(faqHtml, 'topquiz')).toEqual([
			{
				question: 'Какие симптомы характерны?',
				variants: ['Лихорадка', 'Отсутствие жалоб', 'Кашель'],
				answers: ['Лихорадка', 'Кашель'],
				idx: 0,
			},
		]);
	});

	it('разбирает заголовки «Вопрос №N.» на портал-нмо.рф', () => {
		const html = `<div class="entry-content">
			<h4>Вопрос №1. Какой показатель контролируют?</h4>
			<p>1) Температуру воздуха;</p>
			<p><mark>2) Уровень глюкозы плазмы.</mark></p>
		</div>`;
		expect(extractAdditionalCases(html, 'portal-nmo')).toEqual([
			{
				question: 'Какой показатель контролируют?',
				variants: ['Температуру воздуха', 'Уровень глюкозы плазмы'],
				answers: ['Уровень глюкозы плазмы'],
				idx: 0,
			},
		]);
	});

	it('разбирает выделенные цветом #008080 ответы bogoslavsky и игнорирует #toc_container', () => {
		const html = `<div class="entry-content">
			<div id="toc_container"><p>1. Оглавление</p></div>
			<h3><span id="1">1. Что показано пациенту?</span></h3>
			<p>
				<strong>1) </strong><span style="font-size: 18px; color: #008080;">экстренная госпитализация;</span><br />
				2) плановое наблюдение через год;<br />
				3) <span style="color: #008080;">Частичное</span> совпадение текста.
			</p>
		</div>`;
		expect(extractAdditionalCases(html, 'bogoslavsky')).toEqual([
			{
				question: 'Что показано пациенту?',
				variants: ['экстренная госпитализация', 'плановое наблюдение через год', 'Частичное совпадение текста'],
				answers: ['экстренная госпитализация'],
				idx: 0,
			},
		]);
	});

	it('читает выделенные жирным ответы pro-nmo, не принимая частичное выделение за ответ', () => {
		expect(extractAdditionalCases(`<div class="entry-content"><p><strong>1. Вопрос?</strong></p>
		<ul><li>Неверный</li><li><strong>Верный</strong></li><li><strong>Часть</strong> текста</li></ul></div>`, 'pro-nmo')).toEqual([
			{question: 'Вопрос?', variants: ['Неверный', 'Верный', 'Часть текста'], answers: ['Верный'], idx: 0},
		]);
	});

	it('без блока статьи ничего не извлекает из меню и комментариев', () => {
		expect(extractAdditionalCases('<aside><h3>1. Вопрос?</h3><p>1) Ответ +</p></aside>', 'otvnmo')).toEqual([]);
	});

	it('сохраняет химические обозначения и не путает заряд иона с отметкой ответа', () => {
		expect(extractAdditionalCases('<div class="entry-content"><h3>1. Какой ион?</h3><p>1) Na+;<br>2) K+; +</p></div>', 'otvnmo')).toEqual([
			{question: 'Какой ион?', variants: ['Na+', 'K+'], answers: ['K+'], idx: 0},
		]);
	});
});
