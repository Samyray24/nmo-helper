import {render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {PanelStatusProvider, usePanelStatus} from '../../contexts/PanelStatusContext';
import {answerCache} from '../../utils/answer-cache';
import {clearAdditionalSourceCaches} from '../../api/fetch/additional-sources';
import {fetchViaBackground} from '../../api/fetch/fetch';
import SectionAuto from './index';

const state = vi.hoisted(() => ({
	searchFirst: vi.fn(), searchNmo: vi.fn(), searchSecond: vi.fn(), searchThird: vi.fn(),
	getFirst: vi.fn(), setBugReportContext: vi.fn(),
	question: 'Какой вариант подходит?', variants: ['Первый', 'Второй'],
}));
vi.mock('../../contexts/QuestionFinderContext', () => ({useQuestionFinder: () => ({...state, topic: 'Тема', isSingle: true})}));
vi.mock('../../contexts/BugReportContext', () => ({useBugReportContext: () => ({setBugReportContext: state.setBugReportContext})}));
vi.mock('../../api/fetch/search-variant-sources', () => ({
	searchFirstSource: state.searchFirst, searchNmoSource: state.searchNmo,
	searchSecondarySource: state.searchSecond, searchThirdSource: state.searchThird,
}));
vi.mock('../../api/fetch/search-answer-sources', () => ({
	getFirstAnswers: state.getFirst, getNmoAnswers: vi.fn(), getSecondAnswers: vi.fn(), getThirdAnswers: vi.fn(),
}));
vi.mock('../../api/fetch/fetch', async importOriginal => ({
	...await importOriginal<typeof import('../../api/fetch/fetch')>(), fetchViaBackground: vi.fn(),
}));
const mockFetch = vi.mocked(fetchViaBackground);
const ok = (text: string) => ({error: false, status: 200, text});

function Readout() {
	const {status} = usePanelStatus();
	return <output data-testid="status">{status.status}: {status.title}</output>;
}
function setup() { return render(<PanelStatusProvider><SectionAuto/><Readout/></PanelStatusProvider>); }
beforeEach(() => {
	vi.clearAllMocks();
	[state.searchFirst, state.searchNmo, state.searchSecond, state.searchThird].forEach(fn => fn.mockResolvedValue([]));
	answerCache.clear();
	clearAdditionalSourceCaches();
});

describe('Полный маршрут автоматического поиска', () => {
	it('находит ответ по вопросу в новой базе без ручного ввода адреса', async () => {
		mockFetch.mockImplementation(async url => {
			const parsed = new URL(url);
			if (parsed.searchParams.has('s')) return ok(parsed.hostname === 'otvnmo.ru' && parsed.searchParams.get('s') === state.question
				? '<article><h2 class="entry-title"><a href="/test">Ответы на тесты НМО: Тема</a></h2></article>' : 'нет результатов');
			return ok(`<div class="entry-content"><h3>1. ${state.question}</h3><p>1) Первый;<br>2) Второй; +</p></div>`);
		});
		setup();
		await waitFor(() => expect(answerCache.get('Тема', state.question, state.variants)?.answers).toEqual(['Второй']));
		expect(screen.getByTestId('status')).toHaveTextContent('ok: найдено • ОТВ НМО');
	});

	it('при ответе основной базы не обращается к резервным сайтам', async () => {
		state.searchFirst.mockResolvedValue([{source: 'first', title: 'Тема', url: 'https://rosmedicinfo.ru/test'}]);
		state.getFirst.mockResolvedValue([{question: state.question, variants: state.variants, answers: ['Первый'], idx: 0}]);
		setup();
		await waitFor(() => expect(answerCache.get('Тема', state.question, state.variants)?.answers).toEqual(['Первый']));
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('завершает поиск предупреждением, когда ответа нигде нет', async () => {
		mockFetch.mockResolvedValue(ok('нет результатов'));
		setup();
		await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(10));
		await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('warn: ответ не найден'));
		expect(answerCache.get('Тема', state.question, state.variants)).toBeNull();
	});
});
