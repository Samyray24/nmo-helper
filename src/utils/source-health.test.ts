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
});
