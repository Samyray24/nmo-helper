import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import QuizSessionLoader from './QuizSessionLoader';

const mocks = vi.hoisted(() => ({
	cacheGet: vi.fn(), cacheSet: vi.fn(), annotate: vi.fn(),
	restoreQuestion: vi.fn(), saveAnswer: vi.fn(), prune: vi.fn(), complete: vi.fn(),
}));

vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => ({topic: 'Тема', question: 'Вопрос', variants: ['A', 'B']}),
}));
vi.mock('../../contexts/SettingsContext', () => ({
	useSettings: () => ({autoSolve: {recoveryEnabled: true}}),
}));
vi.mock('../../utils', () => ({findCompletedQuizResults: () => false}));
vi.mock('../../utils/answer-cache', () => ({answerCache: {
	get: mocks.cacheGet, set: mocks.cacheSet, annotate: mocks.annotate,
}}));
vi.mock('../../utils/quiz-session-store', () => ({quizSessionStore: {
	restoreQuestion: mocks.restoreQuestion, saveAnswer: mocks.saveAnswer,
	prune: mocks.prune, complete: mocks.complete,
}}));

describe('QuizSessionLoader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.prune.mockResolvedValue(undefined);
		mocks.saveAnswer.mockResolvedValue(undefined);
	});

	it('восстанавливает ответ из постоянной сессии', async () => {
		mocks.cacheGet.mockReturnValue(null);
		mocks.restoreQuestion.mockResolvedValue({answers: ['B'], confidence: 0.9, source: 'сессия', reason: 'найдено', supportCount: 2});
		const {unmount} = render(<QuizSessionLoader/>);
		await waitFor(() => expect(mocks.cacheSet).toHaveBeenCalledWith('Тема', 'Вопрос', ['A', 'B'], ['B'], 0.9));
		expect(mocks.annotate).toHaveBeenCalledWith('Тема', 'Вопрос', ['A', 'B'], expect.objectContaining({source: 'сессия', supportCount: 2}));
		unmount();
	});

	it('сохраняет новый ответ из кэша', async () => {
		mocks.cacheGet.mockReturnValue({id: 'answer-1', answers: ['A'], confidence: 1, source: 'база', reason: 'точно', supportCount: 1});
		const {unmount} = render(<QuizSessionLoader/>);
		await waitFor(() => expect(mocks.saveAnswer).toHaveBeenCalledWith(expect.objectContaining({topic: 'Тема', question: 'Вопрос', answers: ['A']})));
		unmount();
	});
});
