import {describe, expect, it} from 'vitest';
import {DEFAULT_AUTO_SOLVE_ENABLED, normalizeAiProvider, normalizeAutoSolveMode, normalizeConfidenceThreshold, normalizeTestDataSharingEnabled} from './SettingsContext';
import {normalizeUiMode} from './PanelUiContext';

describe('AI provider migration', () => {
	it('включает автопрохождение для новой установки', () => {
		expect(DEFAULT_AUTO_SOLVE_ENABLED).toBe(true);
	});
	it('использует бесплатный режим для новой установки', () => {
		expect(normalizeAiProvider(undefined, 'auto')).toBe('free');
	});

	it('переносит старые ai и ai-pro в отдельного провайдера', () => {
		expect(normalizeAiProvider(undefined, 'ai')).toBe('proxy');
		expect(normalizeAiProvider(undefined, 'ai-pro')).toBe('custom');
		expect(normalizeUiMode('ai-pro')).toBe('ai');
	});

	it('не заменяет уже сохранённого провайдера данными старого режима', () => {
		expect(normalizeAiProvider('free', 'ai-pro')).toBe('free');
		expect(normalizeAiProvider('proxy', 'ai-pro')).toBe('proxy');
		expect(normalizeAiProvider('custom', 'ai')).toBe('custom');
	});
});

describe('automation settings migration', () => {
	it('переносит старый флаг в трёхрежимную настройку', () => {
		expect(normalizeAutoSolveMode(undefined, true)).toBe('full');
		expect(normalizeAutoSolveMode(undefined, false)).toBe('highlight');
		expect(normalizeAutoSolveMode('select', true)).toBe('select');
	});

	it('ограничивает порог уверенности безопасным диапазоном', () => {
		expect(normalizeConfidenceThreshold(2)).toBe(1);
		expect(normalizeConfidenceThreshold(0.1)).toBe(0.5);
		expect(normalizeConfidenceThreshold(undefined)).toBe(0.8);
	});
});

describe('test data sharing opt-in', () => {
	it('считает согласием только явно сохранённое значение true', () => {
		expect(normalizeTestDataSharingEnabled(true)).toBe(true);
		expect(normalizeTestDataSharingEnabled(false)).toBe(false);
		expect(normalizeTestDataSharingEnabled(undefined)).toBe(false);
		expect(normalizeTestDataSharingEnabled('true')).toBe(false);
		expect(normalizeTestDataSharingEnabled(1)).toBe(false);
	});
});
