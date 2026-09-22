import {useEffect} from 'react';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {Status} from '../../types';
import {answerCache} from '../../utils/answer-cache';
import {localAnswerDb} from '../../utils/local-answer-db';

const UNKNOWN_CAPTURE_DELAY_MS = 2500;

/** Ищет вопрос локально до сетевых результатов и сохраняет окончательно неизвестные вопросы. */
export default function LocalAnswerLoader() {
	const {topic, question, variants} = useQuestionFinder();
	const {status, setStatus} = usePanelStatus();

	useEffect(() => {
		if (!question || !variants.length) return;
		let cancelled = false;
		void localAnswerDb.find(topic ?? '', question, variants).then(record => {
			if (cancelled || !record || answerCache.has(topic, question, variants)) return;
			answerCache.set(topic ?? '', question, variants, record.answers, 1);
			answerCache.annotate(topic ?? '', question, variants, {source: 'Локальная база', reason: 'Локальная база · 100%', supportCount: 1});
			setStatus({title: 'найдено • локальная база', status: Status.OK});
		});
		return () => { cancelled = true; };
	}, [topic, question, variants, setStatus]);

	useEffect(() => {
		if (!question || !variants.length || (status.status !== Status.WARN && status.status !== Status.ERR)) return;
		const timer = window.setTimeout(() => {
			if (!answerCache.get(topic ?? '', question, variants)) {
				void localAnswerDb.addUnknown({topic: topic ?? '', question, variants});
			}
		}, UNKNOWN_CAPTURE_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [status.status, topic, question, variants]);

	return null;
}
