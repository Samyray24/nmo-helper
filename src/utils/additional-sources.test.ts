import {describe, expect, it} from 'vitest';
import {ADDITIONAL_SOURCES, extractAdditionalCases, parseAdditionalSearchResults} from './additional-sources';
import {detectSource} from './matching';

describe('Дополнительные базы НМО', () => {
	it.each(['reshtestnmo.ru', 'otvnmo.ru', 'test-nmo.ru', 'pro-nmo.ru', 'tests-nmo.ru'])(
		'распознаёт домен %s и извлекает результаты поиска', host => {
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

	it('не путает название домена в пути или чужой поддомен с новой базой', () => {
		expect(detectSource('https://example.com/reshtestnmo.ru')).toBeNull();
		expect(detectSource('https://otvnmo.ru.example.com/test')).toBeNull();
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
