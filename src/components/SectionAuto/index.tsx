import React, {useEffect, useMemo, useState} from 'react';
import './styles.scss';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useBugReportContext} from '../../contexts/BugReportContext';
import {useAutoSolveStatus} from '../../contexts/AutoSolveStatusContext';
import {answerCache} from '../../utils/answer-cache';
import {Status} from '../../types';
import VariantLoader from '../Loader/VariantLoader';
import AnswerLoader from '../Loader/AnswerLoader';
import AdditionalAnswersLoader, {type IAdditionalSourceState} from '../Loader/AdditionalAnswersLoader';
import {StatusTitle, LOW_CONFIDENCE_THRESHOLD} from '../../utils/constants';
import {pickResult} from '../../utils';
import {findAnswers} from '../../utils/cases';
import type {IParse2Result} from '../../utils/cases';
import {IconBolt} from '../icons';
import InlineToast from '../ui/InlineToast';
import ThinkingStrip from '../ui/ThinkingStrip';
import {statusToToast} from './utils';
import {resolveAnswerDecision} from '../../utils/answer-decision';
import type {IVariantModel} from '../Loader/VariantLoader';
import type {IAnswerModel} from '../Loader/AnswerLoader';

const EMPTY_ANSWER_MODEL: IAnswerModel = {loading: false, error: null, data: null};
const EMPTY_ANSWER_SOURCE_STATE: IAnswerSourceState = {url: '', model: EMPTY_ANSWER_MODEL};

interface IAnswerSourceState {
	readonly url: string;
	readonly model: IAnswerModel;
}

interface IResolvedMatch {
	readonly source: {readonly label: string; readonly url: string};
	readonly found: IParse2Result;
}

type IAutoEvidence =
	| {readonly kind: 'answer'; readonly matches: readonly IResolvedMatch[]; readonly best: IResolvedMatch; readonly supportCount: number}
	| {readonly kind: 'conflict'; readonly matches: readonly IResolvedMatch[]};

const evidenceKey = (evidence: IAutoEvidence | null): string => evidence ? JSON.stringify({
	kind: evidence.kind,
	matches: evidence.matches.map(match => ({
		url: match.source.url,
		answers: match.found.answers,
		score: match.found.score,
		question: match.found.matchedQuestion,
	})),
}) : '';

function updateEvidence(setter: React.Dispatch<React.SetStateAction<IAutoEvidence | null>>, next: IAutoEvidence | null): void {
	setter(current => evidenceKey(current) === evidenceKey(next) ? current : next);
}

const SectionAuto: React.FC = (): React.JSX.Element => {
	// контекст всяктй
	const {status, setStatus} = usePanelStatus();
	const {topic, question, variants} = useQuestionFinder();
	const {setBugReportContext} = useBugReportContext();
	const {status: autoSolveStatus} = useAutoSolveStatus();

	// models
	const [nmoHelperSource, setNmoHelperSource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [firstSource, setFirstSource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [secondarySource, setSecondarySource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [thirdSource, setThirdSource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [searchSettled, setSearchSettled] = useState(false);
	const [additionalSource, setAdditionalSource] = useState<IAdditionalSourceState>({url: '', label: '', model: EMPTY_ANSWER_MODEL});
	const [evidence, setEvidence] = useState<IAutoEvidence | null>(null);
	const nmoMatch = nmoHelperSource.model.data?.length && question && variants.length
		? findAnswers(nmoHelperSource.model.data, question, variants)
		: null;
	const loadOtherSources = !nmoHelperSource.model.loading
		&& (!nmoMatch?.answers.length || nmoMatch.score < LOW_CONFIDENCE_THRESHOLD);
	const existingSources = useMemo(() => [
		{label: 'nmo-helper', ...nmoHelperSource},
		...(loadOtherSources ? [
			{label: 'РосМедИнфо', ...firstSource},
			{label: '24forcare', ...secondarySource},
			{label: 'Testotvet', ...thirdSource},
		] : []),
	].filter(source => source.url), [nmoHelperSource, firstSource, secondarySource, thirdSource, loadOtherSources]);
	const needsAdditionalSources = searchSettled && !!question && !!variants.length
		&& !existingSources.some(source => source.model.loading)
		&& !existingSources.some(source => {
			const found = source.model.data?.length ? findAnswers(source.model.data, question!, variants) : null;
			return !!found?.answers.length && found.score >= LOW_CONFIDENCE_THRESHOLD;
		});

	// Инициализация контекста при каждом входе в режим «Авто».
	useEffect(() => setBugReportContext({mode: 'auto', url: ''}), [setBugReportContext]);

	const _updateSearchUrl = (state: IVariantModel): void => {
		if (!question) return;
		setSearchSettled(!state.loading);

		if (state.loading) {
			updateEvidence(setEvidence, null);
			setFirstSource(EMPTY_ANSWER_SOURCE_STATE);
			setSecondarySource(EMPTY_ANSWER_SOURCE_STATE);
			setNmoHelperSource(EMPTY_ANSWER_SOURCE_STATE);
			setThirdSource(EMPTY_ANSWER_SOURCE_STATE);
			// init status
			setBugReportContext({mode: 'auto', url: ''});
			return setStatus({title: StatusTitle.SEARCHING_ANSWERS, status: Status.LOADING});
		}

		if (state.error) return setStatus({title: state.error, status: Status.WARN});
		if (!state.data.length) return;

		const nmoHelperResult = pickResult(state.data, 'nmo-helper', topic);
		const primaryResult = pickResult(state.data, 'first', topic);
		const secondaryResult = pickResult(state.data, 'second', topic);
		const fooResult = pickResult(state.data, 'third', topic);

		const nextPrimarySourceUrl = primaryResult?.url ?? '';
		const nextSecondarySourceUrl = secondaryResult?.url ?? '';
		const nextNmoHelperUrl = nmoHelperResult?.url ?? '';
		const nextFooUrl = fooResult?.url ?? '';

		setFirstSource({url: nextPrimarySourceUrl, model: {...EMPTY_ANSWER_MODEL, loading: !!nextPrimarySourceUrl}});
		setSecondarySource({url: nextSecondarySourceUrl, model: {...EMPTY_ANSWER_MODEL, loading: !!nextSecondarySourceUrl}});
		setNmoHelperSource({url: nextNmoHelperUrl, model: {...EMPTY_ANSWER_MODEL, loading: !!nextNmoHelperUrl}});
		setThirdSource({url: nextFooUrl, model: {...EMPTY_ANSWER_MODEL, loading: !!nextFooUrl}});

		// update report
		setBugReportContext({
			mode: 'auto',
			url: nextNmoHelperUrl || nextPrimarySourceUrl || nextSecondarySourceUrl || nextFooUrl,
		});

		// ничего не нашли =`(
		if (!primaryResult && !secondaryResult && !nmoHelperResult && !fooResult) {
			setStatus({title: StatusTitle.NOT_FOUND, status: Status.WARN});
		}
	};

	useEffect(() => {
		if (!question || !variants.length) return;

		const sources = [...existingSources, ...(needsAdditionalSources && additionalSource.url ? [additionalSource] : [])];

		// пока пусто
		if (!sources.length && !needsAdditionalSources) return;

		let hasAnswerMismatch = false;
		const matches = sources.flatMap(source => {
			if (source.model.loading || !source.model.data?.length) return [];
			const found = findAnswers(source.model.data, question, variants);
			if (found && !found.answers.length) hasAnswerMismatch = true;
			return found?.answers.length ? [{source, found}] : [];
		}).sort((a, b) => b.found.score - a.found.score);
		const isLoading = sources.some(source => source.model.loading) || (needsAdditionalSources && additionalSource.model.loading);
		const decision = resolveAnswerDecision(matches.map(match => ({
			source: match.source.label,
			label: match.source.label,
			url: match.source.url,
			answers: match.found.answers,
			score: match.found.score,
		})), LOW_CONFIDENCE_THRESHOLD);

		// Не применяем первый ответ, пока остальные выбранные базы ещё загружаются.
		// Иначе автоклик может сработать раньше, чем обнаружится конфликт.
		if (isLoading) {
			updateEvidence(setEvidence, null);
			return setStatus({title: needsAdditionalSources && additionalSource.model.loading ? 'ищу в дополнительных базах...' : StatusTitle.LOADING_ANSWERS, status: Status.LOADING});
		}

		if (decision.kind === 'conflict') {
			answerCache.delete(topic ?? '', question, variants);
			updateEvidence(setEvidence, {kind: 'conflict', matches});
			setBugReportContext({mode: 'auto', url: decision.candidates[0]?.url ?? ''});
			return setStatus({title: 'базы дают разные ответы — автопрохождение остановлено', status: Status.WARN});
		}

		if (decision.kind === 'confirmed') {
			const selected = matches.find(match => match.source.url === decision.selected.url) ?? matches[0];
			answerCache.set(topic ?? '', question, variants, decision.answers, decision.confidence);
			answerCache.annotate?.(topic ?? '', question, variants, {
				source: selected.source.label,
				reason: decision.reason,
				supportCount: decision.supportCount,
			});
			updateEvidence(setEvidence, {kind: 'answer', matches, best: selected, supportCount: decision.supportCount});
			setBugReportContext({mode: 'auto', url: selected.source.url});
			setStatus({
				title: decision.supportCount > 1
					? `ответ подтвердили ${decision.supportCount} источника`
					: `найдено • ${selected.source.label}`,
				status: Status.OK,
			});
			return;
		}
		if (decision.kind === 'low-confidence') {
			const selected = matches.find(match => match.source.url === decision.candidate.url) ?? matches[0];
			answerCache.set(topic ?? '', question, variants, selected.found.answers, selected.found.score);
			answerCache.annotate?.(topic ?? '', question, variants, {
				source: selected.source.label,
				reason: decision.reason,
				supportCount: 1,
			});
			updateEvidence(setEvidence, {kind: 'answer', matches, best: selected, supportCount: 1});
			return setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • ${decision.candidate.label}`, status: Status.WARN});
		}

		updateEvidence(setEvidence, null);
		if (sources.length && sources.every(source => source.model.error)) {
			return setStatus({title: StatusTitle.LOADING_FAILED, status: Status.ERR});
		}
		if (hasAnswerMismatch) return setStatus({title: StatusTitle.ANSWER_MISMATCH, status: Status.WARN});
		setStatus({title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN});

	}, [question, variants, topic, existingSources, needsAdditionalSources, additionalSource, setBugReportContext, setStatus]);

	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isLoading = status.status === Status.LOADING;
	const isOk = status.status === Status.OK;

	const _topc = question ? topic || question : null;
	const autoEnabled = autoSolveStatus.phase !== 'disabled';
	const autoStatusText = autoSolveStatus.secondsRemaining !== null
		? `${autoSolveStatus.message} · ${autoSolveStatus.secondsRemaining} сек.`
		: autoSolveStatus.message;

	return (
		<div className="nmo-section">
			<VariantLoader text={_topc} includeAdditional={false} onChange={_updateSearchUrl}/>
			<AdditionalAnswersLoader enabled={needsAdditionalSources} onChange={setAdditionalSource}/>
			<AnswerLoader url={nmoHelperSource.url}	onChange={model => setNmoHelperSource(source => ({...source, model}))}/>

			{loadOtherSources &&
				<>
					<AnswerLoader url={firstSource.url} onChange={model => setFirstSource(source => ({...source, model}))}/>
					<AnswerLoader url={secondarySource.url}	onChange={model => setSecondarySource(source => ({...source, model}))}/>
					<AnswerLoader url={thirdSource.url} onChange={model => setThirdSource(source => ({...source, model}))}/>
				</>
			}

			<div className="nmo-section-inner">
				<div className="nmo-auto-hero nmo-fade-up">
					<div className="nmo-auto-hero-icon"><IconBolt size={16}/></div>
					<div className="nmo-auto-hero-body">
						<div className="nmo-auto-hero-heading">
							<div className="nmo-auto-hero-title">Автопрохождение</div>
							<span className={`nmo-auto-state ${autoEnabled ? 'on' : 'off'}`}>{autoEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
						</div>
						<div className={`nmo-auto-hero-sub phase-${autoSolveStatus.phase}`} aria-live="polite">{autoStatusText}</div>
					</div>
				</div>
			</div>

			{isLoading && <ThinkingStrip title={status.title} steps={[]}/>}

			{(isWarning || isError || isOk) && status.title && <InlineToast toast={statusToToast(status.title, status.status)}/>}

			{evidence && <div className={`nmo-auto-evidence ${evidence.kind}`}>
				<div className="nmo-auto-evidence-summary">
					<div>
						<div className="nmo-auto-evidence-title">{evidence.kind === 'conflict' ? 'Базы расходятся' : 'Как найден ответ'}</div>
						<div className="nmo-auto-evidence-answer">
							{evidence.kind === 'answer' ? evidence.best.found.answers.join(', ') : 'Нужна ручная проверка'}
						</div>
					</div>
					{evidence.kind === 'answer' && <span className="nmo-auto-confidence">{Math.round(evidence.best.found.score * 100)}%</span>}
				</div>
				<div className="nmo-auto-evidence-support">
					{evidence.kind === 'answer'
						? evidence.supportCount > 1 ? `Подтвердили ${evidence.supportCount} источника` : `Источник: ${evidence.best.source.label}`
						: `${evidence.matches.length} надёжных источника дают разные ответы`}
				</div>
				<details className="nmo-auto-evidence-details">
					<summary>Подробнее об источниках</summary>
					<div className="nmo-auto-evidence-list">
						{evidence.matches.map((match, index) => <div className="nmo-auto-evidence-source" key={`${match.source.url}-${index}`}>
							<div className="nmo-auto-evidence-row">
								<strong>{match.source.label}</strong>
								<span>Точность: {Math.round(match.found.score * 100)}%</span>
							</div>
							<div className="nmo-auto-evidence-question">{match.found.matchedQuestion || question}</div>
							<div className="nmo-auto-evidence-answers">{match.found.answers.join(', ')}</div>
							<a href={match.source.url} target="_blank" rel="noopener noreferrer">Открыть источник ↗</a>
						</div>)}
					</div>
				</details>
				{evidence.kind === 'conflict' && <div className="nmo-auto-evidence-note">Автоматический выбор приостановлен только для этого вопроса.</div>}
			</div>}
		</div>
	);
};

export default SectionAuto;
