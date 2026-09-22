import {act, render} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import AutoAiFallbackLoader from './AutoAiFallbackLoader';

const mocks = vi.hoisted(() => ({askFreeAI: vi.fn(), setStatus: vi.fn(), cacheSet: vi.fn(), annotate: vi.fn()}));
vi.mock('../../api/fetch/fetch-free-ai', () => ({askFreeAI: mocks.askFreeAI}));
vi.mock('../../api/fetch/fetch-ai', () => ({askAI: vi.fn()}));
vi.mock('../../contexts/PanelStatusContext', () => ({usePanelStatus: () => ({status: {status: 'warn', title: 'нет ответа'}, setStatus: mocks.setStatus})}));
vi.mock('../../contexts/QuestionFinderContext', () => ({useQuestionFinder: () => ({topic: 'Тема', question: 'Вопрос', variants: ['A', 'B'], isSingle: true})}));
vi.mock('../../contexts/SettingsContext', () => ({useSettings: () => ({
	autoSolve: {aiFallbackEnabled: true, confidenceThreshold: 0.8},
	ai: {provider: 'free', proxy: {apiKey: '', model: ''}, custom: {url: '', token: '', model: ''}},
})}));
vi.mock('../../utils/answer-cache', () => ({answerCache: {get: () => null, set: mocks.cacheSet, annotate: mocks.annotate}}));

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	mocks.askFreeAI.mockResolvedValue({correctIndexes: [1], source: 'OVH'});
});

describe('AutoAiFallbackLoader', () => {
	it('один раз запускает бесплатный AI после неуспеха баз', async () => {
		render(<AutoAiFallbackLoader/>);
		await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
		expect(mocks.askFreeAI).toHaveBeenCalledOnce();
		expect(mocks.cacheSet).toHaveBeenCalledWith('Тема', 'Вопрос', ['A', 'B'], ['B'], 0.84);
		expect(mocks.setStatus).toHaveBeenLastCalledWith({title: 'резервный AI · OVH', status: 'ok'});
	});
});
