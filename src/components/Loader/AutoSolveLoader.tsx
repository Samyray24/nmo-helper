import {useEffect, useRef} from 'react';
import {useAutoSolveStatus, type AutoSolvePhase} from '../../contexts/AutoSolveStatusContext';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useSettings} from '../../contexts/SettingsContext';
import {Status} from '../../types';
import {
	findCompletedQuizResults,
	getAnswerClickTarget,
	getAnswerInput,
	getFinishQuizConfirmButton,
	getNextQuestionButton,
	getQuestionText,
	getVariantElements,
	getVariantTexts,
	isQuestionFinishButton,
} from '../../utils';
import {claimQuizFinishReload, clearStaleQuizFinishBlockers} from '../../api/quiz-finish-recovery';
import {answerCache} from '../../utils/answer-cache';
import {LOW_CONFIDENCE_THRESHOLD} from '../../utils/constants';
import {quizSessionStore} from '../../utils/quiz-session-store';
import {localAnswerDb} from '../../utils/local-answer-db';

const MOUSE_IDLE_DELAY_MS = 1500;
const AUTO_SOLVE_CHECK_INTERVAL_MS = 250;
const MULTI_ANSWER_DOM_REFRESH_TIMEOUT_MS = 700;
const MULTI_ANSWER_DOM_SETTLE_MS = 350;
const FORWARD_BUTTON_TIMEOUT_MS = 5000;
const QUESTION_CHANGE_TIMEOUT_MS = 8000;
const FINISH_CONFIRM_TIMEOUT_MS = 5000;
const FINISH_RESULTS_TIMEOUT_MS = 12_000;

interface IPlannedAutoSolve {
	readonly id: string;
	readonly idx: number[];
	readonly runAt: number;
}

type PublishStatus = (phase: AutoSolvePhase, message: string, secondsRemaining?: number | null) => void;

/** Управляет безопасным автоматическим выбором ответа и переходом вперёд. */
const AutoSolveLoader = () => {
	const autoSolveSettings = useSettings().autoSolve;
	const mode = autoSolveSettings.mode ?? (autoSolveSettings.enabled ? 'full' : 'highlight');
	const enabled = mode !== 'highlight';
	const confidenceThreshold = autoSolveSettings.confidenceThreshold ?? LOW_CONFIDENCE_THRESHOLD;
	const recoveryEnabled = autoSolveSettings.recoveryEnabled ?? true;
	const {delayMinSeconds, delayMaxSeconds} = autoSolveSettings;
	const {status} = usePanelStatus();
	const {topic, question, variants, isSingle} = useQuestionFinder();
	const {setStatus: setAutoSolveStatus} = useAutoSolveStatus();

	const completedAnswerIdRef = useRef('');
	const plannedAnswerRef = useRef<IPlannedAutoSolve | null>(null);
	const mouseIdleTimerRef = useRef<number | null>(null);
	const mouseActiveRef = useRef(false);
	const runningRef = useRef(false);
	const stopRef = useRef(autoSolveSettings.setEnabled);
	stopRef.current = autoSolveSettings.setEnabled;

	useEffect(() => {
		const markMouseActive = (): void => {
			mouseActiveRef.current = true;
			plannedAnswerRef.current = null;
			if (mouseIdleTimerRef.current !== null) window.clearTimeout(mouseIdleTimerRef.current);
			mouseIdleTimerRef.current = window.setTimeout(() => {
				mouseActiveRef.current = false;
				mouseIdleTimerRef.current = null;
			}, MOUSE_IDLE_DELAY_MS);
		};

		document.addEventListener('mousemove', markMouseActive);
		return () => {
			document.removeEventListener('mousemove', markMouseActive);
			if (mouseIdleTimerRef.current !== null) window.clearTimeout(mouseIdleTimerRef.current);
		};
	}, []);

	useEffect(() => {
		let disposed = false;
		const publish: PublishStatus = (phase, message, secondsRemaining = null): void => {
			if (!disposed) setAutoSolveStatus({phase, message, secondsRemaining});
		};

		const timer = window.setInterval(() => {
			if (!enabled) {
				completedAnswerIdRef.current = '';
				plannedAnswerRef.current = null;
				publish('disabled', 'Автопрохождение выключено');
				return;
			}
			if (runningRef.current) return;

			if (!canAutoSolveWithStatus(status.status)) {
				plannedAnswerRef.current = null;
				if (status.status === Status.LOADING) publish('idle', 'Жду результат поиска');
				else if (status.status === Status.WARN || status.status === Status.ERR) publish('paused', 'Нужна ручная проверка');
				else publish('idle', 'Жду подтверждённый ответ');
				return;
			}

			if (mouseActiveRef.current) {
				plannedAnswerRef.current = null;
				publish('paused', 'Пауза после движения мыши');
				return;
			}

			if (!question || !variants.length) {
				plannedAnswerRef.current = null;
				publish('idle', 'Жду вопрос на странице');
				return;
			}

			const cached = answerCache.get(topic ?? '', question, variants);
			if (!cached?.idx.length || cached.confidence < confidenceThreshold) {
				plannedAnswerRef.current = null;
				publish('idle', 'Жду подтверждённый ответ');
				return;
			}

			const answerId = `${cached.id}::${isSingle ? 'single' : 'multi'}`;
			if (completedAnswerIdRef.current === answerId) {
				publish('idle', 'Ответ уже выбран');
				return;
			}

			let planned = plannedAnswerRef.current;
			if (!planned || planned.id !== answerId) {
				planned = {
					id: answerId,
					idx: [...cached.idx],
					runAt: Date.now() + getRandomDelayMs(delayMinSeconds, delayMaxSeconds),
				};
				plannedAnswerRef.current = planned;
			}

			const remainingMs = planned.runAt - Date.now();
			if (remainingMs > 0) {
				publish('waiting', 'Выбираю ответ через', Math.max(1, Math.ceil(remainingMs / 1000)));
				return;
			}

			plannedAnswerRef.current = null;
			completedAnswerIdRef.current = answerId;
			runningRef.current = true;
			publish('selecting', 'Выбираю правильный ответ');

			void runAutoSolve(planned.idx, topic ?? '', question, variants, mode, recoveryEnabled, publish, () => disposed)
				.then(result => {
					if (result === 'finished') publish('complete', 'Тест завершён');
					else if (result === 'reloading') publish('finishing', 'Обновляю страницу НМО');
					else if (result === 'selected') publish('idle', 'Ответ выбран — переходите дальше');
					else publish('idle', 'Следующий вопрос открыт');
				})
				.catch(error => {
					if (disposed) return;
					stopRef.current(false);
					publish('error', error instanceof Error ? error.message : 'Не удалось продолжить');
				})
				.finally(() => runningRef.current = false);
		}, AUTO_SOLVE_CHECK_INTERVAL_MS);

		return () => {
			disposed = true;
			window.clearInterval(timer);
			plannedAnswerRef.current = null;
		};
	}, [enabled, mode, confidenceThreshold, recoveryEnabled, delayMinSeconds, delayMaxSeconds, status.status, topic, question, variants, isSingle, setAutoSolveStatus]);

	return null;
};

export default AutoSolveLoader;

function getRandomDelayMs(minSeconds: number, maxSeconds: number): number {
	const min = Math.max(0, Math.min(minSeconds, maxSeconds));
	const max = Math.max(min, maxSeconds);
	return Math.round((min + Math.random() * (max - min)) * 1000);
}

function canAutoSolveWithStatus(status: typeof Status[keyof typeof Status]): boolean {
	return status === Status.OK;
}

async function runAutoSolve(correctIndexes: number[], topic: string, currentQuestion: string, variants: string[], mode: 'select' | 'full', recoveryEnabled: boolean, publish: PublishStatus, cancelled: () => boolean): Promise<'selected' | 'next' | 'finished' | 'reloading'> {
	const local = await localAnswerDb.find(topic, currentQuestion, variants);
	if (local?.conflicts?.length) throw new Error('Противоречие в локальной базе — проверьте ответы вручную');
	const assertActive = (): void => {
		if (cancelled()) throw new Error('Автопрохождение остановлено');
		if (getQuestionText()?.trim() !== currentQuestion.trim()) throw new Error('Вопрос изменился — проверьте страницу');
		const current = getVariantTexts();
		if (current.length !== variants.length || current.some((text, index) => text !== variants[index].trim())) throw new Error('Варианты изменились — проверьте страницу');
	};
	if (recoveryEnabled && await quizSessionStore.wasProcessedRecently(topic, currentQuestion, variants)) {
		throw new Error('Этот вопрос уже обработан — жду обновление страницы');
	}
	assertActive();
	await clickAnswerIndexes(correctIndexes, assertActive);
	assertActive();
	if (!await waitUntil(() => {
		assertActive();
		return getVariantElements().every((element, index) => {
			const input = getAnswerInput(element);
			return input !== null && input.checked === correctIndexes.includes(index);
		});
	}, 1500)) throw new Error('Выбор ответа не подтверждён страницей — остановлено');
	if (recoveryEnabled) await quizSessionStore.markProcessed(topic, currentQuestion, variants);
	if (mode === 'select') return 'selected';
	publish('moving', 'Жду готовность кнопки перехода');
	const button = await waitForForwardButton();
	if (!button) throw new Error('Кнопка перехода не стала доступна');
	assertActive();

	const shouldFinish = isQuestionFinishButton(button);
	publish(shouldFinish ? 'finishing' : 'moving', shouldFinish ? 'Завершаю тест' : 'Перехожу к следующему вопросу');
	button.click();

	if (shouldFinish) {
		const confirmation = await waitForFinishConfirmButton();
		if (cancelled()) throw new Error('Автопрохождение остановлено');
		if (confirmation && !isButtonDisabled(confirmation)) confirmation.click();
		publish('finishing', 'Жду страницу результатов');
		if (await waitUntil(() => findCompletedQuizResults() !== null, FINISH_RESULTS_TIMEOUT_MS)) return 'finished';

		if (cancelled()) throw new Error('Автопрохождение остановлено');
		clearStaleQuizFinishBlockers();
		if (recoveryEnabled && claimQuizFinishReload()) {
			publish('finishing', 'Страница НМО не ответила — обновляю');
			window.setTimeout(() => { if (!cancelled()) window.location.reload(); }, 0);
			return 'reloading';
		}
		throw new Error('Страница НМО не ответила — обновите её вручную');
	}

	if (!await waitForQuestionChange(currentQuestion)) throw new Error('Следующий вопрос не загрузился — автопрохождение остановлено');
	return 'next';
}

async function clickAnswerIndexes(correctIndexes: number[], assertActive: () => void): Promise<void> {
	const elements = getVariantElements();
	if (!elements.length) throw new Error('Варианты ответа не найдены');
	const controls = elements.map(getAnswerInput);
	if (controls.some(control => control?.type === 'checkbox')) return clickMultiAnswerIndexes(correctIndexes, assertActive);
	if (!clickSingleAnswerIndex(correctIndexes[0])) throw new Error('Не удалось выбрать ответ');
}

async function clickMultiAnswerIndexes(correctIndexes: number[], assertActive: () => void): Promise<void> {
	const correct = new Set(correctIndexes);
	const length = getVariantElements().length;
	for (let index = 0; index < length; index += 1) {
		assertActive();
		const target = getAnswerTargetAt(index);
		if (!target || target.control.type !== 'checkbox' || target.control.disabled) continue;
		const shouldBeChecked = correct.has(index);
		if (target.control.checked === shouldBeChecked) continue;
		clickAnswerControl(target.control, target.variantElement);
		await waitForAnswerDomRefresh(target.variantElement, index);
	}
}

function clickSingleAnswerIndex(index: number | undefined): boolean {
	if (index === undefined) return false;
	const target = getAnswerTargetAt(index);
	const control = target?.control ?? null;
	if (target && control && !control.disabled) {
		if (!control.checked) clickAnswerControl(control, target.variantElement);
		return true;
	}
	const variant = getVariantElements()[index];
	if (!control && variant) {
		variant.click();
		return true;
	}
	return false;
}

function getAnswerTargetAt(index: number): {control: HTMLInputElement; variantElement: HTMLElement} | null {
	const variantElement = getVariantElements()[index];
	if (!variantElement) return null;
	const control = getAnswerInput(variantElement);
	return control ? {control, variantElement} : null;
}

function clickAnswerControl(control: HTMLInputElement, variantElement: HTMLElement): void {
	const checkedBefore = control.checked;
	control.click();
	if (control.checked === checkedBefore) getAnswerClickTarget(variantElement).click();
}

function wait(ms: number): Promise<void> {
	return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitForAnswerDomRefresh(previousVariantElement: HTMLElement, index: number): Promise<void> {
	await waitUntil(() => getVariantElements()[index] !== previousVariantElement, MULTI_ANSWER_DOM_REFRESH_TIMEOUT_MS);
	await wait(MULTI_ANSWER_DOM_SETTLE_MS);
}

async function waitForForwardButton(): Promise<HTMLButtonElement | null> {
	let button = getNextQuestionButton();
	if (button && !isButtonDisabled(button)) return button;
	const ready = await waitUntil(() => {
		button = getNextQuestionButton();
		return !!button && !isButtonDisabled(button);
	}, FORWARD_BUTTON_TIMEOUT_MS);
	return ready ? button : null;
}

function waitForQuestionChange(previousQuestion: string): Promise<boolean> {
	return waitUntil(() => {
		const current = getQuestionText();
		return !!current?.trim() && current.trim() !== previousQuestion.trim() && getVariantElements().length > 0;
	}, QUESTION_CHANGE_TIMEOUT_MS);
}

function waitForFinishConfirmButton(): Promise<HTMLButtonElement | null> {
	return new Promise(resolve => {
		const existing = getFinishQuizConfirmButton();
		if (existing) return resolve(existing);
		let done = false;
		let observer: MutationObserver | null = null;
		let timeout = 0;
		const finish = (button: HTMLButtonElement | null): void => {
			if (done) return;
			done = true;
			window.clearTimeout(timeout);
			observer?.disconnect();
			resolve(button);
		};
		observer = new MutationObserver(() => {
			const button = getFinishQuizConfirmButton();
			if (button) finish(button);
		});
		timeout = window.setTimeout(() => finish(null), FINISH_CONFIRM_TIMEOUT_MS);
		observer.observe(document.body, {childList: true, subtree: true});
	});
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (predicate()) return true;
		await wait(100);
	}
	return predicate();
}

function isButtonDisabled(button: HTMLButtonElement): boolean {
	return button.disabled || button.getAttribute('aria-disabled') === 'true';
}
