import type {IAnswerModel} from './AnswerLoader';
import {useEffect, useRef} from 'react';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {findAdditionalAnswer} from '../../api/fetch/additional-sources';
import {ADDITIONAL_SOURCES} from '../../utils/constants';
export interface IAdditionalSourceState {readonly url: string; readonly label: string; readonly model: IAnswerModel}
const EMPTY_STATE: IAdditionalSourceState = {url: '', label: '', model: {loading: false, error: null, data: null}};

/** Отменяет применение результата, если пользователь переключил вопрос или режим. */
export default function AdditionalAnswersLoader({enabled, onChange}: {enabled: boolean; onChange: (state: IAdditionalSourceState) => void}) {
	const {topic, question, variants, isSingle} = useQuestionFinder();
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	useEffect(() => {
		if (!enabled || !question || !variants.length) { onChangeRef.current(EMPTY_STATE); return; }
		let cancelled = false;
		onChangeRef.current({...EMPTY_STATE, model: {...EMPTY_STATE.model, loading: true}});
		void findAdditionalAnswer(topic, question, variants, () => cancelled, isSingle).then(result => {
			if (cancelled) return;
			onChangeRef.current(result ? {
				url: result.url,
				label: ADDITIONAL_SOURCES.find(source => source.key === result.source)!.label,
				model: {loading: false, error: null, data: result.model},
			} : EMPTY_STATE);
		}).catch(() => {
			if (!cancelled) onChangeRef.current({...EMPTY_STATE, model: {...EMPTY_STATE.model, error: 'ошибка поиска в дополнительных базах'}});
		});
		return () => { cancelled = true; };
	}, [enabled, topic, question, variants, isSingle]);
	return null;
}
