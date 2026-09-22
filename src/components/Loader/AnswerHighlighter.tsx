import { useEffect, useRef } from 'react';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { answerCache } from '../../utils/answer-cache';
import { getVariantElements, getQuestionText, getTopicElement, cleanTopic } from '../../utils';
import { HIGHLIGHT_COLOR, LOW_CONFIDENCE_HIGHLIGHT_COLOR, LOW_CONFIDENCE_THRESHOLD, StatusTitle } from '../../utils/constants';
import { Status } from '../../types';

/**
 * Подсвечивает цветом `HIGHLIGHT_COLOR` DOM-элементы из `elements`,
 * индексы которых входят в `correctIndexes`. Idempotent: уже
 * подсвеченные не трогает, чтобы не перетирать inline-стиль на ровном месте.
 */
export function highlightByIndexes(elements: HTMLElement[], correctIndexes: number[], confidence = 1): void {
	const color = confidence < LOW_CONFIDENCE_THRESHOLD ? LOW_CONFIDENCE_HIGHLIGHT_COLOR : HIGHLIGHT_COLOR;
	elements.forEach((el, i) => {
		if (correctIndexes.includes(i)) {
			if (el.dataset.nmoAnswerOriginalColor === undefined) el.dataset.nmoAnswerOriginalColor = el.style.color;
			el.style.color = color;
			el.dataset.nmoAnswerAppliedColor = el.style.color;
		}
		else restoreAnswerColor(el);
	});
}

function restoreAnswerColor(el: HTMLElement): void {
	if (el.dataset.nmoAnswerOriginalColor === undefined) return;
	if (el.style.color === el.dataset.nmoAnswerAppliedColor) el.style.color = el.dataset.nmoAnswerOriginalColor;
	delete el.dataset.nmoAnswerOriginalColor;
	delete el.dataset.nmoAnswerAppliedColor;
}

function clearAnswerHighlights(): void {
	document.querySelectorAll<HTMLElement>('[data-nmo-answer-original-color]').forEach(restoreAnswerColor);
}

/**
 * Headless-компонент: каждые 200ms проверяет answerCache и подсвечивает.
 * Статус «кеш» выводится только при смене вопроса на ранее закешированный.
 * Если ответ только что записали — молчит (статус уже поставил тот, кто нашёл).
 *
 * Кеш пересчитывает `cached.idx` по текущему порядку вариантов в DOM.
 */
const AnswerHighlighter = () => {
	const { setStatus } = usePanelStatus();
	const lastKeyRef = useRef('');

	useEffect(() => {
		const timer = setInterval(() => {
			const question = getQuestionText();
			if (!question) {
				lastKeyRef.current = '';
				return clearAnswerHighlights();
			}

			const elements = getVariantElements();
			const variants = elements.map(el => el.innerText.trim());
			if (!variants.length) return clearAnswerHighlights();

			const topicEl = getTopicElement();
			const topic = cleanTopic(topicEl?.innerText?.trim() ?? null) ?? '';

			const cached = answerCache.get(topic, question, variants);
			if (!cached || !cached.idx.length) {
				lastKeyRef.current = '';
				return clearAnswerHighlights();
			}

			highlightByIndexes(elements, cached.idx, cached.confidence);

			if (lastKeyRef.current === cached.id) return;
			lastKeyRef.current = cached.id;

			// Только что записали — молчим, статус уже есть
			if (answerCache.fresh(topic, question, variants)) return;

			// Вернулись к ранее закешированному вопросу
			setStatus(cached.confidence < LOW_CONFIDENCE_THRESHOLD
				? {title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • в памяти`, status: Status.WARN}
				: {title: 'найдено в памяти', status: Status.OK});

		}, 200);

		return () => {
			clearInterval(timer);
			clearAnswerHighlights();
		};
	}, [setStatus]);

	return null;
};

export default AnswerHighlighter;
