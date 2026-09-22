import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import AdditionalAnswersLoader from './AdditionalAnswersLoader';

const state = vi.hoisted(() => ({
	find: vi.fn(), topic: 'Тема', question: 'Первый вопрос', variants: ['A', 'B'],
}));
vi.mock('../../contexts/QuestionFinderContext', () => ({useQuestionFinder: () => state}));
vi.mock('../../api/fetch/additional-sources', () => ({findAdditionalAnswer: state.find}));
beforeEach(() => { state.find.mockReset().mockResolvedValue(null); state.question = 'Первый вопрос'; });

describe('AdditionalAnswersLoader', () => {
	it('не запускает поиск, пока у основных баз есть подходящий ответ', async () => {
		render(<AdditionalAnswersLoader enabled={false} onChange={vi.fn()}/>);
		expect(state.find).not.toHaveBeenCalled();
	});
	it('возвращает страницу и название базы для автоматической подсветки', async () => {
		const model = [{question: 'Первый вопрос', variants: ['A', 'B'], answers: ['B'], idx: 0}];
		state.find.mockResolvedValue({source: 'otvnmo', url: 'https://otvnmo.ru/test', model, match: {answers: ['B'], score: 1}});
		const onChange = vi.fn();
		render(<AdditionalAnswersLoader enabled onChange={onChange}/>);
		await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({
			url: 'https://otvnmo.ru/test', label: 'ОТВ НМО', model: {loading: false, error: null, data: model},
		}));
	});
	it('не отдаёт ответ на предыдущий вопрос после переключения страницы', async () => {
		let resolve: (value: unknown) => void = () => {};
		state.find.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValue(null);
		const onChange = vi.fn();
		const {rerender} = render(<AdditionalAnswersLoader enabled onChange={onChange}/>);
		state.question = 'Другой вопрос';
		rerender(<AdditionalAnswersLoader enabled onChange={onChange}/>);
		await waitFor(() => expect(state.find).toHaveBeenCalledTimes(2));
		resolve({source: 'otvnmo', url: 'https://otvnmo.ru/stale', model: [], match: {answers: ['B'], score: 1}});
		await waitFor(() => expect(onChange.mock.lastCall?.[0].model.loading).toBe(false));
		expect(onChange.mock.calls.some(([value]) => value.url === 'https://otvnmo.ru/stale')).toBe(false);
	});
});
