import { describe, it, expect } from 'vitest';
import { AnswerCache, answerCache } from './answer-cache';

describe('AnswerCache.set + get', () => {
	it('удаляет только ответ указанного вопроса', () => {
		const c = new AnswerCache();
		c.set('Тема', 'Первый вопрос', ['A', 'B'], ['A']);
		c.set('Тема', 'Второй вопрос', ['A', 'B'], ['B']);

		expect(c.delete('Тема', 'Первый вопрос', ['A', 'B'])).toBe(true);
		expect(c.get('Тема', 'Первый вопрос', ['A', 'B'])).toBeNull();
		expect(c.get('Тема', 'Второй вопрос', ['A', 'B'])?.answers).toEqual(['B']);
	});
	it('очищает ответы и метки свежести при смене источника', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b'], ['b']);
		c.clear();

		expect(c.has('T', 'Q', ['a', 'b'])).toBe(false);
		expect(c.get('T', 'Q', ['a', 'b'])).toBeNull();
		expect(c.fresh('T', 'Q', ['a', 'b'])).toBe(false);
	});
	it('сохраняет уверенность ответа для последующего автоответа', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b'], ['b'], 0.2);

		expect(c.get('T', 'Q', ['b', 'a'])!.confidence).toBe(0.2);
	});
	it('сохраняет происхождение и объяснение ответа', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b'], ['b'], 0.95);
		c.annotate('T', 'Q', ['a', 'b'], {source: 'local', reason: 'Локальная база · 95%', supportCount: 1});

		expect(c.get('T', 'Q', ['a', 'b'])).toMatchObject({source: 'local', reason: 'Локальная база · 95%', supportCount: 1});
	});
	it('сохраняет и достаёт запись по тройке (topic, question, variants)', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b', 'c'], ['b']);

		const got = c.get('T', 'Q', ['a', 'b', 'c']);
		expect(got).not.toBeNull();
		expect(got!.answers).toEqual(['b']);
		expect(got!.idx).toEqual([1]);
	});

	it('возвращает null для неизвестного ключа', () => {
		const c = new AnswerCache();
		expect(c.get('T', 'Q', ['a'])).toBeNull();
	});

	it('id содержит topic/question/variants', () => {
		const c = new AnswerCache();
		const entry = c.set('T', 'Q', ['a'], ['a']);
		expect(entry.id).toContain('t');
		expect(entry.id).toContain('q');
		expect(entry.id).toContain('a');
	});

	it('answers копируется, а не мутируется через внешнюю ссылку', () => {
		const c = new AnswerCache();
		const answers = ['a'];
		c.set('T', 'Q', ['a', 'b'], answers);
		answers.push('b');

		const got = c.get('T', 'Q', ['a', 'b'])!;
		expect(got.answers).toEqual(['a']);
	});

	it('idx корректен для нескольких правильных ответов', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b', 'c', 'd'], ['a', 'c', 'd']);

		const got = c.get('T', 'Q', ['a', 'b', 'c', 'd'])!;
		expect(got.idx).toEqual([0, 2, 3]);
	});

	it('idx пуст если ни один answer не нашёлся в variants', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b'], ['z']);

		const got = c.get('T', 'Q', ['a', 'b'])!;
		expect(got.idx).toEqual([]);
	});
});

describe('AnswerCache — нормализация ключа', () => {
	it('регистронезависимый topic', () => {
		const c = new AnswerCache();
		c.set('Кардиология', 'Q', ['a'], ['a']);
		expect(c.get('КАРДИОЛОГИЯ', 'Q', ['a'])).not.toBeNull();
		expect(c.get('кардиология', 'Q', ['a'])).not.toBeNull();
	});

	it('регистронезависимый question', () => {
		const c = new AnswerCache();
		c.set('T', 'Какой препарат?', ['a'], ['a']);
		expect(c.get('T', 'КАКОЙ ПРЕПАРАТ?', ['a'])).not.toBeNull();
	});

	it('регистронезависимые variants', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['Аспирин', 'Ибупрофен'], ['Аспирин']);
		expect(c.get('T', 'Q', ['АСПИРИН', 'ИБУПРОФЕН'])).not.toBeNull();
	});

	it('игнорирует пробелы в начале/конце', () => {
		const c = new AnswerCache();
		c.set('  T  ', '  Q  ', ['  a  '], ['a']);
		expect(c.get('T', 'Q', ['a'])).not.toBeNull();
	});

	it('ключ инвариантен к перестановке variants', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b', 'c'], ['b']);
		// запрашиваем в другом порядке — ключ тот же после внутренней сортировки
		expect(c.get('T', 'Q', ['c', 'a', 'b'])).not.toBeNull();
		expect(c.get('T', 'Q', ['b', 'c', 'a'])).not.toBeNull();
	});

	it('пересчитывает индекс правильного ответа после перестановки вариантов', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b', 'c'], ['b']);

		expect(c.get('T', 'Q', ['b', 'c', 'a'])!.idx).toEqual([0]);
		expect(c.get('T', 'Q', ['c', 'a', 'b'])!.idx).toEqual([2]);
		expect(c.get('T', 'Q', ['a', 'b', 'c'])!.idx).toEqual([1]);
	});

	it('пересчитывает все индексы множественного ответа', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b', 'c'], ['a', 'c']);

		expect(c.get('T', 'Q', ['c', 'a', 'b'])!.idx).toEqual([0, 1]);
	});

	it('разные variants дают разные записи', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b'], ['a']);
		expect(c.get('T', 'Q', ['a', 'c'])).toBeNull();
	});

	it('разные question дают разные записи', () => {
		const c = new AnswerCache();
		c.set('T', 'Q1', ['a'], ['a']);
		expect(c.get('T', 'Q2', ['a'])).toBeNull();
	});
});

describe('AnswerCache.has', () => {
	it('true после set', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a'], ['a']);
		expect(c.has('T', 'Q', ['a'])).toBe(true);
	});

	it('false до set', () => {
		const c = new AnswerCache();
		expect(c.has('T', 'Q', ['a'])).toBe(false);
	});

	it('принимает null topic/question (трактует как пустую строку)', () => {
		const c = new AnswerCache();
		c.set('', '', ['a'], ['a']);
		expect(c.has(null, null, ['a'])).toBe(true);
	});

	it('принимает null variants → пустая тройка', () => {
		const c = new AnswerCache();
		c.set('', '', [], []);
		expect(c.has(null, null, null as unknown as string[])).toBe(true);
	});
});

describe('AnswerCache.fresh', () => {
	it('true на первый вызов после set, затем false', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a'], ['a']);

		expect(c.fresh('T', 'Q', ['a'])).toBe(true);
		expect(c.fresh('T', 'Q', ['a'])).toBe(false);
	});

	it('false для незнакомой тройки', () => {
		const c = new AnswerCache();
		expect(c.fresh('T', 'Q', ['a'])).toBe(false);
	});

	it('fresh отдельно для каждой записи', () => {
		const c = new AnswerCache();
		c.set('T', 'Q1', ['a'], ['a']);
		c.set('T', 'Q2', ['b'], ['b']);

		expect(c.fresh('T', 'Q1', ['a'])).toBe(true);
		expect(c.fresh('T', 'Q2', ['b'])).toBe(true);
		expect(c.fresh('T', 'Q1', ['a'])).toBe(false);
	});

	it('повторный set возвращает fresh-метку', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a'], ['a']);
		expect(c.fresh('T', 'Q', ['a'])).toBe(true);
		expect(c.fresh('T', 'Q', ['a'])).toBe(false);

		c.set('T', 'Q', ['a'], ['a']);
		expect(c.fresh('T', 'Q', ['a'])).toBe(true);
	});
});

describe('AnswerCache.set — перезапись', () => {
	it('повторный set по той же тройке перезаписывает answers', () => {
		const c = new AnswerCache();
		c.set('T', 'Q', ['a', 'b'], ['a']);
		c.set('T', 'Q', ['a', 'b'], ['b']);

		const got = c.get('T', 'Q', ['a', 'b'])!;
		expect(got.answers).toEqual(['b']);
		expect(got.idx).toEqual([1]);
	});
});

describe('answerCache — синглтон', () => {
	it('экспортируется и является экземпляром AnswerCache', () => {
		expect(answerCache).toBeInstanceOf(AnswerCache);
	});
});
