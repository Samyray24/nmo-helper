import {useEffect, useRef} from 'react';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {answerCache} from '../../utils/answer-cache';
import {quizSessionStore} from '../../utils/quiz-session-store';
import {findCompletedQuizResults} from '../../utils';
import {useSettings} from '../../contexts/SettingsContext';

/** Восстанавливает и сохраняет найденные ответы между обновлениями страницы НМО. */
export default function QuizSessionLoader() {
	const {topic, question, variants} = useQuestionFinder();
	const recoveryEnabled = useSettings().autoSolve.recoveryEnabled ?? true;
	const lastKeyRef = useRef('');

	useEffect(() => {
		if (!recoveryEnabled || !topic) return;
		void quizSessionStore.prune();
		if (findCompletedQuizResults()) void quizSessionStore.complete(topic);
	}, [recoveryEnabled, topic]);

	useEffect(() => {
		if (!recoveryEnabled || !question || !variants.length) return;
		let cancelled = false;
		const normalizedTopic = topic ?? '';
		const sync = async (): Promise<void> => {
			const cached = answerCache.get(normalizedTopic, question, variants);
			if (!cached) {
				const restored = await quizSessionStore.restoreQuestion(normalizedTopic, question, variants);
				if (cancelled || !restored) return;
				answerCache.set(normalizedTopic, question, variants, restored.answers, restored.confidence);
				answerCache.annotate(normalizedTopic, question, variants, {
					source: restored.source,
					reason: `Восстановлено · ${restored.reason}`,
					supportCount: restored.supportCount,
				});
				return;
			}
			if (cached.id === lastKeyRef.current) return;
			lastKeyRef.current = cached.id;
			await quizSessionStore.saveAnswer({
				topic: normalizedTopic,
				question,
				variants,
				answers: cached.answers,
				confidence: cached.confidence,
				source: cached.source ?? 'memory',
				reason: cached.reason ?? 'Найдено в текущей сессии',
				supportCount: cached.supportCount ?? 1,
			});
		};
		void sync();
		const timer = window.setInterval(() => void sync(), 400);
		return () => { cancelled = true; window.clearInterval(timer); };
	}, [recoveryEnabled, topic, question, variants]);

	return null;
}
