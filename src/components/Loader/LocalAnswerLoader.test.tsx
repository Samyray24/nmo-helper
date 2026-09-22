import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import LocalAnswerLoader from './LocalAnswerLoader';

const mocks = vi.hoisted(() => ({
	status: 'idle', setStatus: vi.fn(), find: vi.fn(), addUnknown: vi.fn(),
	cacheHas: vi.fn(), cacheGet: vi.fn(), cacheSet: vi.fn(), annotate: vi.fn(),
}));
vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => ({topic: 'Тема', question: 'Вопрос', variants: ['A', 'B']}),
}));
vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({status: {status: mocks.status}, setStatus: mocks.setStatus}),
}));
vi.mock('../../utils/answer-cache', () => ({answerCache: {
	has: mocks.cacheHas, get: mocks.cacheGet, set: mocks.cacheSet, annotate: mocks.annotate,
}}));
vi.mock('../../utils/local-answer-db', () => ({localAnswerDb: {find: mocks.find, addUnknown: mocks.addUnknown}}));

describe('LocalAnswerLoader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.status = 'idle';
		mocks.cacheHas.mockReturnValue(false);
		mocks.cacheGet.mockReturnValue(null);
		mocks.find.mockResolvedValue(null);
		mocks.addUnknown.mockResolvedValue(undefined);
	});

	it('помещает локальный ответ в общий кэш', async () => {
		mocks.find.mockResolvedValue({answers: ['B']});
		const {unmount} = render(<LocalAnswerLoader/>);
		await waitFor(() => expect(mocks.cacheSet).toHaveBeenCalledWith('Тема', 'Вопрос', ['A', 'B'], ['B'], 1));
		expect(mocks.setStatus).toHaveBeenCalledWith({title: 'найдено • локальная база', status: 'ok'});
		unmount();
	});

	it('записывает окончательно неизвестный вопрос', async () => {
		vi.useFakeTimers();
		mocks.status = 'warn';
		const {unmount} = render(<LocalAnswerLoader/>);
		await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
		expect(mocks.addUnknown).toHaveBeenCalledWith({topic: 'Тема', question: 'Вопрос', variants: ['A', 'B']});
		unmount();
		vi.clearAllTimers();
		vi.useRealTimers();
	});
});
