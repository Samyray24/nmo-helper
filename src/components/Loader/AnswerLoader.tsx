import {useEffect, useRef} from 'react';
import { detectSource } from '../../utils';
import {getFirstAnswers, getNmoAnswers, getSecondAnswers, getThirdAnswers} from '../../api/fetch/search-answer-sources';
import type {QaCaseModel} from '../../utils/cases';
import {isAdditionalSource} from '../../utils/additional-sources';
import {getAdditionalAnswers} from '../../api/fetch/additional-sources';

export interface IAnswerModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: QaCaseModel[] | null;
}

const INIT_STATE: IAnswerModel = { loading: false, error: null, data: null };

interface IAnswerLoaderProps {
	readonly url: string;
	readonly onChange: (state: IAnswerModel) => void;
}

const AnswerLoader = ({url, onChange}: IAnswerLoaderProps) => {
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		const trimmed = url.trim();
		if (!trimmed) return onChangeRef.current({...INIT_STATE});

		let valid: URL;
		try {
			valid = new URL(trimmed);
		} catch {
			onChangeRef.current({ loading: false, error: 'некорректный URL', data: null });
			return;
		}

		const sourceKey = detectSource(valid.href);
		if (!sourceKey) return onChangeRef.current({loading: false, error: 'URL не относится к поддерживаемой базе ответов', data: null});

		onChangeRef.current({ loading: true, error: null, data: null });

		let cancelled = false;

		async function load() {
			try {
				let model: QaCaseModel[];
				if (sourceKey === 'nmo-helper') model = await getNmoAnswers(valid.href);
				else if (sourceKey === 'third') model = await getThirdAnswers(valid.href);
				else if (sourceKey === 'first') model = await getFirstAnswers(valid.href);
				else if (isAdditionalSource(sourceKey)) model = await getAdditionalAnswers(valid.href);
				else model = await getSecondAnswers(valid.href);

				if (cancelled) return;

				onChangeRef.current({loading: false, error: null, data: model});

			} catch (error) {
				if (cancelled) return;
				const message = (error as Error).message;
				onChangeRef.current({loading: false, error: message, data: null});
			}
		}

		load();

		return () => { cancelled = true; };

	}, [url]);

	return null;
};

export default AnswerLoader;
