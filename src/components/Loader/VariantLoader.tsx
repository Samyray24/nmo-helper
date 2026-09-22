import {useEffect} from 'react';
import type {ISearchResult} from '../../types';
import {searchFirstSource, searchNmoSource, searchSecondarySource, searchThirdSource} from '../../api/fetch/search-variant-sources';
import {searchAdditionalSource} from '../../api/fetch/additional-sources';
import {ADDITIONAL_SOURCES} from '../../utils/constants';

export interface IVariantModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ISearchResult[];
}

const INIT_STATE: IVariantModel = {loading: false, error: null, data: []};

interface IVariantLoaderProps {
	readonly text: string | null;
	readonly onChange: (state: IVariantModel) => void;
	readonly includeAdditional?: boolean;
}

const VariantLoader = ({text, onChange, includeAdditional = true}: IVariantLoaderProps) => {
	useEffect(() => {
		const query = (text ?? '').trim();
		if (!query) return onChange({...INIT_STATE});

		onChange({loading: true, error: null, data: []});

		let cancelled = false;

		async function search() {
			const resultGroups = await Promise.all([
				searchNmoSource(query).catch(() => []),
				searchSecondarySource(query).catch(() => []),
				searchFirstSource(query).catch(() => []),
				searchThirdSource(query).catch(() => []),
				...(includeAdditional ? ADDITIONAL_SOURCES.map(source => searchAdditionalSource(query, source.key).catch(() => [])) : []),
			]);

			if (cancelled) return;

			const results = resultGroups.flat();
			if (!results.length) return onChange({loading: false, error: 'ничего не найдено', data: []});


			onChange({loading: false, error: null, data: results});
		}

		search();

		return () => { cancelled = true; };
	}, [text, includeAdditional]);

	return null;
};

export default VariantLoader;
