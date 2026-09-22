import {act, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {PanelStatusProvider, usePanelStatus} from '../../contexts/PanelStatusContext';
import {answerCache} from '../../utils/answer-cache';
import AnswerHighlighter, {highlightByIndexes} from './AnswerHighlighter';

function StatusReadout() {
	const {status} = usePanelStatus();
	return <output data-testid="answer-status">{status.status}</output>;
}

afterEach(() => vi.useRealTimers());

describe('AnswerHighlighter', () => {
	it('снимает подсветку старого ответа после смены правильного варианта', () => {
		const elements = [document.createElement('span'), document.createElement('span')];
		elements[0].style.color = 'red';
		highlightByIndexes(elements, [0]);
		highlightByIndexes(elements, [1]);

		expect(elements[0].style.color).toBe('red');
		expect(elements[1].style.color).toBe('rgb(78, 204, 163)');
	});
	it('подсвечивает слабое совпадение жёлтым цветом', () => {
		const elements = [document.createElement('span'), document.createElement('span')];
		highlightByIndexes(elements, [1], 0.2);

		expect(elements[0].style.color).toBe('');
		expect(elements[1].style.color).toBe('rgb(245, 193, 75)');
	});
	it('сохраняет предупреждение при восстановлении неуверенного ответа из памяти', async () => {
		vi.useFakeTimers();
		document.body.innerHTML = '<h1 class="mat-card-title-quiz-custom">Неуверенная тема</h1><div id="questionAnchor"><div class="question-title-text">Вопрос?</div><div class="mdc-form-field"><span>Первый</span></div><div class="mdc-form-field"><span>Второй</span></div></div>';
		document.querySelectorAll('h1, span').forEach(element => {
			Object.defineProperty(element, 'innerText', {get: () => element.textContent});
		});
		answerCache.set('Неуверенная тема', 'Вопрос?', ['Первый', 'Второй'], ['Второй'], 0.2);
		answerCache.fresh('Неуверенная тема', 'Вопрос?', ['Первый', 'Второй']);
		render(<PanelStatusProvider><AnswerHighlighter/><StatusReadout/></PanelStatusProvider>);

		await act(async () => vi.advanceTimersByTimeAsync(200));

		expect(screen.getByTestId('answer-status')).toHaveTextContent('warn');
	});
});
