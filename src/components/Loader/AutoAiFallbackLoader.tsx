import {useEffect, useRef} from 'react';
import {askAI} from '../../api/fetch/fetch-ai';
import {askFreeAI} from '../../api/fetch/fetch-free-ai';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useSettings} from '../../contexts/SettingsContext';
import {Status} from '../../types';
import {answerCache} from '../../utils/answer-cache';
import {questionFingerprint} from '../../utils/question-fingerprint';

const FALLBACK_DELAY_MS = 900;

/** Автоматически обращается к AI один раз, если базы завершили поиск без надёжного ответа. */
export default function AutoAiFallbackLoader() {
	const {status, setStatus} = usePanelStatus();
	const {topic, question, variants, isSingle} = useQuestionFinder();
	const settings = useSettings();
	const attemptedRef = useRef(new Set<string>());
	const generationRef = useRef(0);
	const enabled = settings.autoSolve.aiFallbackEnabled ?? true;
	const threshold = settings.autoSolve.confidenceThreshold ?? 0.8;
	useEffect(() => {
		generationRef.current += 1;
		return () => { generationRef.current += 1; };
	}, [enabled, settings.ai, question, variants, isSingle, topic]);

	useEffect(() => {
		if (!enabled || !question || !variants.length) return;
		if (status.status !== Status.WARN && status.status !== Status.ERR) return;
		const existing = answerCache.get(topic ?? '', question, variants);
		if (existing && existing.confidence >= threshold) return;
		const fingerprint = questionFingerprint(topic ?? '', question, variants);
		if (attemptedRef.current.has(fingerprint)) return;
		if (!hasProviderConfiguration(settings.ai)) return;

		const generation = generationRef.current;
		const timer = window.setTimeout(() => {
			attemptedRef.current.add(fingerprint);
			setStatus({title: 'базы не помогли — спрашиваю AI...', status: Status.LOADING});
			void solveWithProvider(settings.ai, question, variants, isSingle, topic ?? '')
				.then(({indexes, source}) => {
					if (generation !== generationRef.current) return;
					if (!indexes.length) {
						setStatus({title: 'AI не определил ответ', status: Status.WARN});
						return;
					}
					const answers = indexes.map(index => variants[index]).filter(Boolean);
					answerCache.set(topic ?? '', question, variants, answers, 0.84);
					answerCache.annotate(topic ?? '', question, variants, {
						source: `AI · ${source}`,
						reason: `Резервный AI · ${source} · ответ модели, не подтверждён базой`,
						supportCount: 1,
					});
					setStatus({title: `резервный AI · ${source}`, status: Status.OK});
				})
				.catch(error => {
					if (generation === generationRef.current) setStatus({title: `AI-резерв: ${error instanceof Error ? error.message : 'ошибка'}`, status: Status.WARN});
				});
		}, FALLBACK_DELAY_MS);

		return () => { window.clearTimeout(timer); };
	}, [enabled, threshold, status.status, settings.ai, question, variants, isSingle, topic, setStatus]);

	return null;
}

type AiSettings = ReturnType<typeof useSettings>['ai'];

function hasProviderConfiguration(ai: AiSettings): boolean {
	if (ai.provider === 'free') return true;
	if (ai.provider === 'proxy') return !!ai.proxy.apiKey && !!ai.proxy.model;
	return !!ai.custom.url && !!ai.custom.token && !!ai.custom.model;
}

async function solveWithProvider(ai: AiSettings, question: string, variants: string[], isSingle: boolean, topic: string): Promise<{indexes: number[]; source: string}> {
	if (ai.provider === 'free') {
		const result = await askFreeAI(question, variants, isSingle, topic);
		return {indexes: result.correctIndexes, source: result.source};
	}
	if (ai.provider === 'proxy') {
		return {indexes: await askAI(ai.proxy.apiKey, question, variants, isSingle, topic, ai.proxy.model), source: 'ProxyAPI'};
	}
	return {
		indexes: await askAI(ai.custom.token, question, variants, isSingle, topic, ai.custom.model, ai.custom.url),
		source: 'свой endpoint',
	};
}
