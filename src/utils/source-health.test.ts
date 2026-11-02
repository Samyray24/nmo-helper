import {beforeEach, describe, expect, it} from 'vitest';
import {sourceHealth} from './source-health';

beforeEach(() => sourceHealth.clear());

describe('sourceHealth', () => {
	it('открывает circuit после трёх сбоев и возвращает источник через две минуты', () => {
		for (let i = 0; i < 3; i += 1) sourceHealth.record('https://base.example/search', 503, 100, true, 1000 + i);
		expect(sourceHealth.isAvailable('base.example', 2000)).toBe(false);
		expect(sourceHealth.isAvailable('base.example', 122_003)).toBe(true);
	});

	it('сбрасывает серию ошибок после успеха и выше ставит быстрый стабильный сайт', () => {
		sourceHealth.record('https://fast.example/a', 200, 100, false);
		sourceHealth.record('https://slow.example/a', 200, 10_000, false);
		sourceHealth.record('https://slow.example/a', 500, 10_000, true);
		expect(sourceHealth.snapshot()[0].host).toBe('fast.example');
		expect(sourceHealth.snapshot().find(item => item.host === 'fast.example')).toMatchObject({successRate: 1, available: true});
	});

	it('приостанавливает источник после трёх нераспознанных страниц ответов, но не после пустого поиска', () => {
		const url = 'https://base.example/answer';
		sourceHealth.recordSearchResult(url, 0);
		expect(sourceHealth.isAvailable('base.example', 1_000)).toBe(true);
		for (let i = 0; i < 3; i += 1) sourceHealth.recordAnswerResult(url, 0, 1_000 + i);
		expect(sourceHealth.snapshot(2_000)[0]).toMatchObject({consecutiveParseFailures: 3, available: false});
		sourceHealth.record(url, 200, 50, false, 2_000);
		expect(sourceHealth.isAvailable('base.example', 2_000)).toBe(false);
		expect(sourceHealth.isAvailable('base.example', 121_003)).toBe(true);
		sourceHealth.recordAnswerResult(url, 2, 121_003);
		expect(sourceHealth.snapshot(121_003)[0]).toMatchObject({consecutiveParseFailures: 0, available: true});
	});
});
