import {act, render} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import AutoAiFallbackLoader from './AutoAiFallbackLoader';

const mocks = vi.hoisted(() => ({status: 'warn', question: 'Вопрос', variants: ['A', 'B'], ai: {provider: 'free', proxy: {apiKey: '', model: ''}, custom: {url: '', token: '', model: ''}}, askFreeAI: vi.fn(), setStatus: vi.fn(), cacheSet: vi.fn(), annotate: vi.fn()}));
vi.mock('../../api/fetch/fetch-free-ai', () => ({askFreeAI: mocks.askFreeAI}));
vi.mock('../../api/fetch/fetch-ai', () => ({askAI: vi.fn()}));
vi.mock('../../contexts/PanelStatusContext', () => ({usePanelStatus: () => ({status: {status: mocks.status, title: 'нет ответа'}, setStatus: mocks.setStatus})}));
vi.mock('../../contexts/QuestionFinderContext', () => ({useQuestionFinder: () => ({topic: 'Тема', question: mocks.question, variants: mocks.variants, isSingle: true})}));
vi.mock('../../contexts/SettingsContext', () => ({useSettings: () => ({
	autoSolve: {aiFallbackEnabled: true, confidenceThreshold: 0.8},
	ai: mocks.ai,
})}));
vi.mock('../../utils/answer-cache', () => ({answerCache: {get: () => null, set: mocks.cacheSet, annotate: mocks.annotate}}));

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	mocks.status = 'warn'; mocks.question = 'Вопрос';
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

it('сохраняет ответ после собственного перехода в loading', async () => {
	let complete!: (value: {correctIndexes: number[]; source: string}) => void;
	mocks.askFreeAI.mockReturnValue(new Promise(resolve => { complete = resolve; }));
	const view = render(<AutoAiFallbackLoader/>);
	await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
	mocks.status = 'loading'; view.rerender(<AutoAiFallbackLoader/>);
	await act(async () => { complete({correctIndexes: [1], source: 'OVH'}); });
	expect(mocks.cacheSet).toHaveBeenCalledOnce();
});
it('отбрасывает ответ AI после смены вопроса', async () => {
	let complete!: (value: {correctIndexes: number[]; source: string}) => void;
	mocks.askFreeAI.mockReturnValue(new Promise(resolve => { complete = resolve; }));
	const view = render(<AutoAiFallbackLoader/>);
	await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
	mocks.question = 'Другой вопрос'; view.rerender(<AutoAiFallbackLoader/>);
	await act(async () => { complete({correctIndexes: [1], source: 'OVH'}); });
	expect(mocks.cacheSet).not.toHaveBeenCalled();
});
