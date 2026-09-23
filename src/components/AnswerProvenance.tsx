import React from 'react';
import {usePanelStatus} from '../contexts/PanelStatusContext';
import {useQuestionFinder} from '../contexts/QuestionFinderContext';
import {answerCache} from '../utils/answer-cache';

export default function AnswerProvenance() {
	usePanelStatus();
	const {topic, question, variants} = useQuestionFinder();
	const answer = question ? answerCache.get(topic ?? '', question, variants) : null;
	if (!answer?.reason) return null;
	return <details className="nmo-provenance"><summary>Откуда ответ: {answer.source}</summary><p>{answer.reason}</p><p>Совпадение текста не является вероятностью правильного ответа.</p></details>;
}
