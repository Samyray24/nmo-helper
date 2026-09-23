import {act, cleanup, fireEvent, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Status} from '../../types';
import AutoSolveLoader from './AutoSolveLoader';

const mocks = vi.hoisted(() => ({
	autoSolveEnabled: true,
	autoSolveMode: undefined as 'highlight' | 'select' | 'full' | undefined,
	confidenceThreshold: 0.8,
	delayMinSeconds: 0,
	delayMaxSeconds: 0,
	status: 'ok',
	topic: 'Кардиология - 2025',
	question: 'Какой вариант правильный?',
	variants: ['Вариант A', 'Вариант B', 'Вариант C'],
	isSingle: true,
	getCachedAnswer: vi.fn(),
	setAutoStatus: vi.fn(),
	setEnabled: vi.fn(),
}));

vi.mock('../../contexts/SettingsContext', () => ({
	useSettings: () => ({
		autoSolve: {
			enabled: mocks.autoSolveEnabled,
			setEnabled: mocks.setEnabled,
			mode: mocks.autoSolveMode,
			confidenceThreshold: mocks.confidenceThreshold,
			delayMinSeconds: mocks.delayMinSeconds,
			delayMaxSeconds: mocks.delayMaxSeconds,
		},
	}),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({
		status: {
			title: 'Ответ найден',
			status: mocks.status,
		},
	}),
}));

vi.mock('../../contexts/AutoSolveStatusContext', () => ({
	useAutoSolveStatus: () => ({setStatus: mocks.setAutoStatus}),
}));

vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => ({
		topic: mocks.topic,
		question: mocks.question,
		variants: mocks.variants,
		isSingle: mocks.isSingle,
	}),
}));

vi.mock('../../utils/answer-cache', () => ({
	answerCache: {get: mocks.getCachedAnswer},
}));

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-08-22T10:00:00Z'));

	mocks.autoSolveEnabled = true;
	mocks.autoSolveMode = undefined;
	mocks.confidenceThreshold = 0.8;
	mocks.delayMinSeconds = 0;
	mocks.delayMaxSeconds = 0;
	mocks.status = Status.OK;
	mocks.topic = 'Кардиология - 2025';
	mocks.question = 'Какой вариант правильный?';
	mocks.variants = ['Вариант A', 'Вариант B', 'Вариант C'];
	mocks.isSingle = true;
	mocks.getCachedAnswer.mockReset().mockReturnValue({
		id: 'cached-answer-1',
		answers: ['Вариант B'],
		idx: [1],
	});
	mocks.setAutoStatus.mockReset();
	mocks.setEnabled.mockReset();

	document.body.innerHTML = createQuizMarkup('radio');
});

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('AutoSolveLoader', () => {
	it('останавливается во время ожидания кнопки и не нажимает её после Стоп', async () => {
		const button = getNextButton(); button.disabled = true;
		const clicked = vi.fn(); button.addEventListener('click', clicked);
		const view = render(<AutoSolveLoader/>);
		await advanceTime(900);
		mocks.autoSolveEnabled = false;
		view.rerender(<AutoSolveLoader/>);
		button.disabled = false;
		await advanceTime(1000);
		expect(clicked).not.toHaveBeenCalled();
	});
	it('не принимает исчезновение вопроса за успешный переход', async () => {
		getNextButton().addEventListener('click', () => document.querySelector('#questionAnchor')?.remove());
		render(<AutoSolveLoader/>);
		await advanceTime(9000);
		expect(mocks.setEnabled).toHaveBeenCalledWith(false);
		expect(mocks.setAutoStatus).not.toHaveBeenCalledWith(expect.objectContaining({message: 'Следующий вопрос открыт'}));
	});
	it('останавливается, если страница отменила выбор ответа', async () => {
		getAnswerInputs()[1].addEventListener('click', event => event.preventDefault());
		const clicked = vi.fn(); getNextButton().addEventListener('click', clicked);
		render(<AutoSolveLoader/>);
		await advanceTime(2500);
		expect(clicked).not.toHaveBeenCalled();
		expect(mocks.setEnabled).toHaveBeenCalledWith(false);
	});

	it('в осторожном режиме ничего не нажимает', async () => {
		mocks.autoSolveMode = 'highlight';
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);
		render(<AutoSolveLoader/>);
		await advanceTime(1000);
		expect(getAnswerInputs().every(input => !input.checked)).toBe(true);
		expect(nextClick).not.toHaveBeenCalled();
		expect(mocks.setAutoStatus).toHaveBeenCalledWith(expect.objectContaining({phase: 'disabled'}));
	});

	it('в обычном режиме выбирает ответ, но не переходит дальше', async () => {
		mocks.autoSolveMode = 'select';
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);
		render(<AutoSolveLoader/>);
		await advanceTime(1000);
		expect(getAnswerInputs()[1]).toBeChecked();
		expect(nextClick).not.toHaveBeenCalled();
		expect(mocks.setAutoStatus).toHaveBeenCalledWith(expect.objectContaining({message: 'Ответ выбран — переходите дальше'}));
	});

	it('выбирает сохранённый radio-ответ, переходит дальше и не отвечает повторно', async () => {
		const inputs = getAnswerInputs();
		const answerClick = vi.fn();
		const nextClick = vi.fn();
		inputs[1].addEventListener('click', answerClick);
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(900);

		expect(mocks.getCachedAnswer).toHaveBeenCalledWith(
			'Кардиология - 2025',
			'Какой вариант правильный?',
			['Вариант A', 'Вариант B', 'Вариант C'],
		);
		expect(inputs[0]).not.toBeChecked();
		expect(inputs[1]).toBeChecked();
		expect(inputs[2]).not.toBeChecked();
		expect(answerClick).toHaveBeenCalledOnce();
		expect(nextClick).toHaveBeenCalledOnce();

		await advanceTime(3000);

		expect(answerClick).toHaveBeenCalledOnce();
		expect(nextClick).toHaveBeenCalledOnce();
	});

	it('соблюдает настроенную задержку перед выбором ответа', async () => {
		mocks.delayMinSeconds = 2;
		mocks.delayMaxSeconds = 2;
		const inputs = getAnswerInputs();
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(2249);

		expect(inputs[1]).not.toBeChecked();
		expect(nextClick).not.toHaveBeenCalled();

		await advanceTime(1);

		expect(inputs[1]).toBeChecked();
		expect(nextClick).toHaveBeenCalledOnce();
	});

	it('показывает обратный отсчёт до автоматического выбора', async () => {
		mocks.delayMinSeconds = 2;
		mocks.delayMaxSeconds = 2;
		render(<AutoSolveLoader/>);

		await advanceTime(250);
		expect(mocks.setAutoStatus).toHaveBeenLastCalledWith({
			phase: 'waiting', message: 'Выбираю ответ через', secondsRemaining: 2,
		});

		await advanceTime(1000);
		expect(mocks.setAutoStatus).toHaveBeenLastCalledWith({
			phase: 'waiting', message: 'Выбираю ответ через', secondsRemaining: 1,
		});
	});

	it('синхронизирует checkbox-варианты с сохранённым множественным ответом', async () => {
		mocks.isSingle = false;
		mocks.getCachedAnswer.mockReturnValue({
			id: 'cached-multi-answer',
			answers: ['Вариант A', 'Вариант C'],
			idx: [0, 2],
		});
		document.body.innerHTML = createQuizMarkup('checkbox', [1, 2]);
		const inputs = getAnswerInputs();
		const clicks = inputs.map(() => vi.fn());
		const nextClick = vi.fn();
		inputs.forEach((input, index) => input.addEventListener('click', clicks[index]));
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(3400);

		expect(inputs[0]).toBeChecked();
		expect(inputs[1]).not.toBeChecked();
		expect(inputs[2]).toBeChecked();
		expect(clicks[0]).toHaveBeenCalledOnce();
		expect(clicks[1]).toHaveBeenCalledOnce();
		expect(clicks[2]).not.toHaveBeenCalled();
		expect(nextClick).toHaveBeenCalledOnce();
	});

	it('откладывает ответ до периода бездействия после последнего движения мыши', async () => {
		const inputs = getAnswerInputs();
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);
		render(<AutoSolveLoader/>);

		fireEvent.mouseMove(document);
		await advanceTime(1499);
		fireEvent.mouseMove(document);
		await advanceTime(1500);

		expect(inputs[1]).not.toBeChecked();

		await advanceTime(301);

		expect(inputs[1]).toBeChecked();
		expect(nextClick).toHaveBeenCalledOnce();
	});

	it('подтверждает завершение теста после появления диалога', async () => {
		document.body.innerHTML = createQuizMarkup('radio', [], true);
		const finishClick = vi.fn();
		const confirmClick = vi.fn();
		getNextButton().addEventListener('click', () => {
			finishClick();
			window.setTimeout(() => {
				document.body.insertAdjacentHTML('beforeend', createFinishDialogMarkup());
				document.querySelector('#finish-confirm')?.addEventListener('click', () => {
					confirmClick();
					document.body.innerHTML = createCompletedQuizMarkup();
				});
			}, 100);
		});

		render(<AutoSolveLoader/>);
		await advanceTime(1000);

		expect(finishClick).toHaveBeenCalledOnce();
		expect(confirmClick).toHaveBeenCalledOnce();
		expect(mocks.setAutoStatus).toHaveBeenCalledWith({
			phase: 'complete', message: 'Тест завершён', secondsRemaining: null,
		});
	});

	it.each(['Завершить тест', 'Завершить попытку'])('распознаёт финальную кнопку «%s»', async label => {
		document.body.innerHTML = createQuizMarkup('radio').replace('Следующий вопрос', label);
		const finishClick = vi.fn();
		getNextButton().addEventListener('click', finishClick);

		render(<AutoSolveLoader/>);
		await advanceTime(1000);

		expect(finishClick).toHaveBeenCalledOnce();
	});

	it.each([
		['настройка выключена', false, Status.OK, true],
		['статус панели не разрешает автоответ', true, Status.LOADING, true],
		['ответ найден с предупреждением', true, Status.WARN, true],
		['ответ отсутствует в кеше', true, Status.OK, false],
	] as const)('ничего не нажимает, если %s', async (_name, enabled, status, hasCachedAnswer) => {
		mocks.autoSolveEnabled = enabled;
		mocks.status = status;
		if (!hasCachedAnswer) mocks.getCachedAnswer.mockReturnValue(null);
		const inputs = getAnswerInputs();
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(5000);

		expect(inputs.every(input => !input.checked)).toBe(true);
		expect(nextClick).not.toHaveBeenCalled();
	});

	it('не выбирает неуверенный кешированный ответ даже при статусе OK', async () => {
		mocks.getCachedAnswer.mockReturnValue({
			id: 'uncertain-answer', answers: ['Вариант B'], idx: [1], confidence: 0.2,
		});
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);
		render(<AutoSolveLoader/>);
		await advanceTime(5000);

		expect(getAnswerInputs().every(input => !input.checked)).toBe(true);
		expect(nextClick).not.toHaveBeenCalled();
	});

	it('игнорирует кешированную запись без индексов ответа', async () => {
		mocks.getCachedAnswer.mockReturnValue({
			id: 'cached-empty-answer',
			answers: [],
			idx: [],
		});
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(5000);

		expect(getAnswerInputs().every(input => !input.checked)).toBe(true);
		expect(nextClick).not.toHaveBeenCalled();
	});

	it('не нажимает недоступную кнопку перехода', async () => {
		const nextButton = getNextButton();
		nextButton.setAttribute('aria-disabled', 'true');
		const nextClick = vi.fn();
		nextButton.addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(1000);

		expect(getAnswerInputs()[1]).toBeChecked();
		expect(nextClick).not.toHaveBeenCalled();
	});

	it('переходит дальше, когда кнопка становится доступна', async () => {
		const nextButton = getNextButton();
		nextButton.setAttribute('aria-disabled', 'true');
		const nextClick = vi.fn();
		nextButton.addEventListener('click', nextClick);
		render(<AutoSolveLoader/>);

		await advanceTime(900);
		expect(getAnswerInputs()[1]).toBeChecked();
		expect(nextClick).not.toHaveBeenCalled();

		nextButton.removeAttribute('aria-disabled');
		await advanceTime(100);
		expect(nextClick).toHaveBeenCalledOnce();
	});

	it('не переходит дальше, если состояние ответа нельзя проверить', async () => {
		document.body.innerHTML = createQuizMarkupWithoutInputs();
		const variants = Array.from(document.querySelectorAll<HTMLElement>('.mdc-form-field span'));
		const answerClick = vi.fn();
		const nextClick = vi.fn();
		variants[1].addEventListener('click', answerClick);
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(2500);

		expect(answerClick).toHaveBeenCalledOnce();
		expect(nextClick).not.toHaveBeenCalled();
		expect(mocks.setEnabled).toHaveBeenCalledWith(false);
	});
});

async function advanceTime(ms: number): Promise<void> {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

function getAnswerInputs(): HTMLInputElement[] {
	return Array.from(document.querySelectorAll<HTMLInputElement>('#questionAnchor input'));
}

function getNextButton(): HTMLButtonElement {
	return document.querySelector<HTMLButtonElement>('.question-buttons-primary')!;
}

function createQuizMarkup(
	type: 'radio' | 'checkbox',
	checkedIndexes: readonly number[] = [],
	finish = false,
): string {
	const variants = ['Вариант A', 'Вариант B', 'Вариант C']
		.map((variant, index) => `
			<div class="mdc-form-field">
				<input
					id="answer-${index}"
					type="${type}"
					name="answer"
					${checkedIndexes.includes(index) ? 'checked' : ''}>
				<label for="answer-${index}"><span>${variant}</span></label>
			</div>
		`)
		.join('');

	return `
		<div id="questionAnchor">
			<div class="question-title-text">Какой вариант правильный?</div>
			${variants}
		</div>
		<div class="question-buttons">
			<button class="question-buttons-primary">
				${finish ? 'Завершить тестирование' : 'Следующий вопрос'}
			</button>
		</div>
	`;
}

function createQuizMarkupWithoutInputs(): string {
	const variants = ['Вариант A', 'Вариант B', 'Вариант C']
		.map(variant => `<div class="mdc-form-field"><span>${variant}</span></div>`)
		.join('');

	return `
		<div id="questionAnchor">
			<div class="question-title-text">Какой вариант правильный?</div>
			${variants}
		</div>
		<div class="question-buttons">
			<button class="question-buttons-primary">Следующий вопрос</button>
		</div>
	`;
}

function createFinishDialogMarkup(): string {
	return `
		<div class="mat-mdc-dialog-surface">
			<p>Выйти из тестирования?</p>
			<div class="mat-mdc-dialog-actions">
				<button>Нет</button>
				<button id="finish-confirm">Да</button>
			</div>
		</div>
	`;
}

function createCompletedQuizMarkup(): string {
	return `
		<lib-quiz-page>
			<div class="text_value text-success">Завершен</div>
			<lib-questions-list>
				<div class="questionList"><div class="questionList-item"></div></div>
			</lib-questions-list>
		</lib-quiz-page>
	`;
}
