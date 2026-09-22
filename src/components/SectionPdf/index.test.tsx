import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PanelStatusProvider} from '../../contexts/PanelStatusContext';
import {PdfScoreProvider, usePdfScore} from '../../contexts/PdfScoreContext';
import {answerCache} from '../../utils/answer-cache';
import SectionPdf from './index';

const variants = ['A', 'B'];
vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => ({topic: 'Тема', question: 'Вопрос', variants, isSingle: true}),
}));
vi.mock('./components/PdfSourceViewer', () => ({default: () => null}));
vi.mock('med-pdf-nmo/browser', () => ({
	setPdfJsLib: vi.fn(),
	answerQuestion: async () => ({
		selected: ['B'], confidence: 0.9, sources: null,
		scores: [{id: '0', variant: 'A', score: 0.1, raw: 1}, {id: '1', variant: 'B', score: 0.9, raw: 9}],
	}),
}));

function OldScores() {
	const {setPdfScore, getPdfScore} = usePdfScore();
	return <>
		<button onClick={() => setPdfScore('Тема', 'Другой вопрос', variants, [])}>seed</button>
		<output data-testid="old-score">{getPdfScore('Тема', 'Другой вопрос', variants) ? 'old' : 'empty'}</output>
	</>;
}

function setup() {
	return render(<PanelStatusProvider><PdfScoreProvider><SectionPdf/><OldScores/></PdfScoreProvider></PanelStatusProvider>);
}

function upload(container: HTMLElement) {
	fireEvent.change(container.querySelector('input[type=file]')!, {
		target: {files: [new File(['pdf-content'], 'guide.pdf', {type: 'application/pdf'})]},
	});
}

describe('Смена PDF', () => {
	beforeEach(() => {
		answerCache.clear();
		vi.stubGlobal('pdfjsLib', {GlobalWorkerOptions: {workerSrc: ''}});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('анализирует загруженный документ вместо использования старого ответа', async () => {
		const {container} = setup();
		answerCache.set('Тема', 'Вопрос', variants, ['A']);
		upload(container);
		await waitFor(() => expect(answerCache.get('Тема', 'Вопрос', variants)?.answers).toEqual(['B']));
	});

	it('очищает оценки всех вопросов предыдущего документа', async () => {
		const {container} = setup();
		fireEvent.click(screen.getByRole('button', {name: 'seed'}));
		expect(screen.getByTestId('old-score')).toHaveTextContent('old');
		upload(container);
		await waitFor(() => expect(screen.getByText('guide.pdf')).toBeInTheDocument());
		expect(screen.getByTestId('old-score')).toHaveTextContent('empty');
	});

	it('удаляет ответы и все оценки при удалении PDF', async () => {
		const {container} = setup();
		upload(container);
		await waitFor(() => expect(answerCache.get('Тема', 'Вопрос', variants)?.answers).toEqual(['B']));
		fireEvent.click(screen.getByRole('button', {name: 'seed'}));
		fireEvent.click(container.querySelector('.nmo-pdf-loaded button')!);
		expect(answerCache.get('Тема', 'Вопрос', variants)).toBeNull();
		expect(screen.getByTestId('old-score')).toHaveTextContent('empty');
	});
});
