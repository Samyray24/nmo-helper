import {describe, expect, it} from 'vitest';
import {detectBrowser} from './browser-capabilities';

describe('detectBrowser', () => {
	it('различает Firefox ESR, Chromium, Edge и Яндекс', () => {
		expect(detectBrowser('Mozilla Firefox/115.9').family).toBe('firefox');
		expect(detectBrowser('Mozilla Chrome/124.0 YaBrowser/24.1').family).toBe('yandex');
		expect(detectBrowser('Mozilla Chrome/124.0 Edg/124.0').family).toBe('edge');
		expect(detectBrowser('Mozilla Chromium/120.0').family).toBe('chromium');
	});
});
