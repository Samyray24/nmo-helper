import React, {createContext, useContext, useState} from 'react';
import {storageSet} from '../utils';
import type {AiProvider, AutoSolveMode, IExtensionState} from '../types';
import {answerCache} from '../utils/answer-cache';

export const AI_PROVIDER_STORAGE_KEY = 'aiProvider';
export const DEFAULT_AI_PROVIDER: AiProvider = 'free';
export const AUTO_SOLVE_STORAGE_KEY = 'autoSolveTests';
export const AUTO_SOLVE_MODE_STORAGE_KEY = 'autoSolveMode';
export const CONFIDENCE_THRESHOLD_STORAGE_KEY = 'confidenceThreshold';
export const AI_FALLBACK_STORAGE_KEY = 'aiFallbackEnabled';
export const RECOVERY_STORAGE_KEY = 'quizRecoveryEnabled';
export const AUTO_SOLVE_DELAY_MIN_STORAGE_KEY = 'autoSolveDelayMinSeconds';
export const AUTO_SOLVE_DELAY_MAX_STORAGE_KEY = 'autoSolveDelayMaxSeconds';
export const TEST_DATA_SHARING_STORAGE_KEY = 'testDataSharingEnabled';
export const DEFAULT_TEST_DATA_SHARING_ENABLED = false;
export const DEFAULT_AUTO_SOLVE_ENABLED = true;
export const DEFAULT_AUTO_SOLVE_MODE: AutoSolveMode = 'full';
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;
export const DEFAULT_AI_FALLBACK_ENABLED = true;
export const DEFAULT_RECOVERY_ENABLED = true;
export const MIN_AUTO_SOLVE_DELAY_SECONDS = 5;
export const DEFAULT_AUTO_SOLVE_DELAY_MIN_SECONDS = 5;
export const DEFAULT_AUTO_SOLVE_DELAY_MAX_SECONDS = 12;

interface ISettingsProviderProps {
	readonly initialState: IExtensionState;
}

interface IProxyAiSettings {
	readonly apiKey: string;
	readonly setApiKey: (apiKey: string) => void;
	readonly model: string;
	readonly setModel: (model: string) => void;
}

interface ICustomAiSettings {
	readonly url: string;
	readonly setUrl: (url: string) => void;
	readonly token: string;
	readonly setToken: (token: string) => void;
	readonly model: string;
	readonly setModel: (model: string) => void;
}

interface IAiSettings {
	readonly provider: AiProvider;
	readonly setProvider: (provider: AiProvider) => void;
	readonly proxy: IProxyAiSettings;
	readonly custom: ICustomAiSettings;
}

interface IAutoSolveSettings {
	readonly enabled: boolean;
	readonly setEnabled: (enabled: boolean) => void;
	readonly mode: AutoSolveMode;
	readonly setMode: (mode: AutoSolveMode) => void;
	readonly confidenceThreshold: number;
	readonly setConfidenceThreshold: (value: number) => void;
	readonly aiFallbackEnabled: boolean;
	readonly setAiFallbackEnabled: (enabled: boolean) => void;
	readonly recoveryEnabled: boolean;
	readonly setRecoveryEnabled: (enabled: boolean) => void;
	readonly delayMinSeconds: number;
	readonly setDelayMinSeconds: (seconds: number) => void;
	readonly delayMaxSeconds: number;
	readonly setDelayMaxSeconds: (seconds: number) => void;
}

interface ITestDataSharingSettings {
	readonly enabled: boolean;
	readonly setEnabled: (enabled: boolean) => void;
}

interface ISettingsState {
	readonly ai: IAiSettings;
	readonly autoSolve: IAutoSolveSettings;
	readonly testDataSharing: ITestDataSharingSettings;
}

const SettingsContext = createContext<ISettingsState>(null!);

export const SettingsProvider: React.FC<React.PropsWithChildren<ISettingsProviderProps>> = ({initialState, children}) => {

	// ai
	const [aiProvider, setAiProviderRaw] = useState(normalizeAiProvider(initialState.savedAiProvider, initialState.savedMode));

	// ai proxy
	const [apiKey, setApiKeyRaw] = useState(initialState.savedApiKey);
	const [aiModel, setAiModelRaw] = useState(initialState.savedModel);

	// ai custom
	const [customAiUrl, setCustomAiUrlRaw] = useState(initialState.savedCustomAiUrl);
	const [customAiToken, setCustomAiTokenRaw] = useState(initialState.savedCustomAiToken);
	const [customAiModel, setCustomAiModelRaw] = useState(initialState.savedCustomAiModel);

	// settings auto-solve
	const [autoSolveMode, setAutoSolveModeRaw] = useState(normalizeAutoSolveMode(initialState.savedAutoSolveMode, initialState.savedAutoSolveEnabled));
	const [confidenceThreshold, setConfidenceThresholdRaw] = useState(normalizeConfidenceThreshold(initialState.savedConfidenceThreshold));
	const [aiFallbackEnabled, setAiFallbackEnabledRaw] = useState(initialState.savedAiFallbackEnabled ?? DEFAULT_AI_FALLBACK_ENABLED);
	const [recoveryEnabled, setRecoveryEnabledRaw] = useState(initialState.savedRecoveryEnabled ?? DEFAULT_RECOVERY_ENABLED);

	const initialMin = normalizeDelaySeconds(initialState.savedAutoSolveDelayMinSeconds, DEFAULT_AUTO_SOLVE_DELAY_MIN_SECONDS);
	const [autoSolveDelayMinSeconds, setAutoSolveDelayMinSecondsRaw] = useState(initialMin);

	const initialMax = Math.max(normalizeDelaySeconds(initialState.savedAutoSolveDelayMaxSeconds, DEFAULT_AUTO_SOLVE_DELAY_MAX_SECONDS), initialMin);
	const [autoSolveDelayMaxSeconds, setAutoSolveDelayMaxSecondsRaw] = useState(initialMax);

	// settings sharing
	const [testDataSharingEnabled, setTestDataSharingEnabledRaw] = useState(normalizeTestDataSharingEnabled(initialState.savedTestDataSharingEnabled));


	const setAiProvider = (provider: AiProvider): void => {
		if (provider !== aiProvider) answerCache.clear();
		setAiProviderRaw(provider);
		storageSet(AI_PROVIDER_STORAGE_KEY, provider);
	};

	const setApiKey = (nextApiKey: string): void => {
		if (nextApiKey !== apiKey) answerCache.clear();
		setApiKeyRaw(nextApiKey);
		storageSet('apiKey', nextApiKey);
	};

	const setAiModel = (model: string): void => {
		if (model !== aiModel) answerCache.clear();
		setAiModelRaw(model);
		storageSet('aiModel', model);
	};

	const setCustomAiUrl = (url: string): void => {
		if (url !== customAiUrl) answerCache.clear();
		setCustomAiUrlRaw(url);
		storageSet('customAiUrl', url);
	};

	const setCustomAiToken = (token: string): void => {
		if (token !== customAiToken) answerCache.clear();
		setCustomAiTokenRaw(token);
		storageSet('customAiToken', token);
	};

	const setCustomAiModel = (model: string): void => {
		if (model !== customAiModel) answerCache.clear();
		setCustomAiModelRaw(model);
		storageSet('customAiModel', model);
	};

	const setAutoSolveEnabled = (enabled: boolean): void => {
		const nextMode: AutoSolveMode = enabled ? 'full' : 'highlight';
		setAutoSolveModeRaw(nextMode);
		storageSet(AUTO_SOLVE_STORAGE_KEY, enabled);
		storageSet(AUTO_SOLVE_MODE_STORAGE_KEY, nextMode);
	};

	const setAutoSolveMode = (mode: AutoSolveMode): void => {
		setAutoSolveModeRaw(mode);
		storageSet(AUTO_SOLVE_MODE_STORAGE_KEY, mode);
		storageSet(AUTO_SOLVE_STORAGE_KEY, mode !== 'highlight');
	};

	const setConfidenceThreshold = (value: number): void => {
		const normalized = normalizeConfidenceThreshold(value);
		setConfidenceThresholdRaw(normalized);
		storageSet(CONFIDENCE_THRESHOLD_STORAGE_KEY, normalized);
	};

	const setAiFallbackEnabled = (enabled: boolean): void => {
		setAiFallbackEnabledRaw(enabled);
		storageSet(AI_FALLBACK_STORAGE_KEY, enabled);
	};

	const setRecoveryEnabled = (enabled: boolean): void => {
		setRecoveryEnabledRaw(enabled);
		storageSet(RECOVERY_STORAGE_KEY, enabled);
	};

	const setTestDataSharingEnabled = (enabled: boolean): void => {
		setTestDataSharingEnabledRaw(enabled);
		storageSet(TEST_DATA_SHARING_STORAGE_KEY, enabled);
	};

	const setAutoSolveDelayMinSeconds = (seconds: number): void => {
		const nextMin = normalizeDelaySeconds(seconds, autoSolveDelayMinSeconds);

		setAutoSolveDelayMinSecondsRaw(nextMin);
		storageSet(AUTO_SOLVE_DELAY_MIN_STORAGE_KEY, nextMin);

		if (autoSolveDelayMaxSeconds < nextMin) {
			setAutoSolveDelayMaxSecondsRaw(nextMin);
			storageSet(AUTO_SOLVE_DELAY_MAX_STORAGE_KEY, nextMin);
		}
	};

	const setAutoSolveDelayMaxSeconds = (seconds: number): void => {
		const nextMax = Math.max(
			normalizeDelaySeconds(seconds, autoSolveDelayMaxSeconds),
			autoSolveDelayMinSeconds
		);

		setAutoSolveDelayMaxSecondsRaw(nextMax);
		storageSet(AUTO_SOLVE_DELAY_MAX_STORAGE_KEY, nextMax);
	};

	return (
		<SettingsContext.Provider value={{
			ai: {
				provider: aiProvider,
				setProvider: setAiProvider,
				proxy: {
					apiKey,
					setApiKey,
					model: aiModel,
					setModel: setAiModel,
				},
				custom: {
					url: customAiUrl,
					setUrl: setCustomAiUrl,
					token: customAiToken,
					setToken: setCustomAiToken,
					model: customAiModel,
					setModel: setCustomAiModel,
				},
			},
			autoSolve: {
				enabled: autoSolveMode !== 'highlight',
				setEnabled: setAutoSolveEnabled,
				mode: autoSolveMode,
				setMode: setAutoSolveMode,
				confidenceThreshold,
				setConfidenceThreshold,
				aiFallbackEnabled,
				setAiFallbackEnabled,
				recoveryEnabled,
				setRecoveryEnabled,
				delayMinSeconds: autoSolveDelayMinSeconds,
				setDelayMinSeconds: setAutoSolveDelayMinSeconds,
				delayMaxSeconds: autoSolveDelayMaxSeconds,
				setDelayMaxSeconds: setAutoSolveDelayMaxSeconds,
			},
			testDataSharing: {
				enabled: testDataSharingEnabled,
				setEnabled: setTestDataSharingEnabled,
			},
		}}>
			{children}
		</SettingsContext.Provider>
	);
};

export const useSettings = () => useContext(SettingsContext);

export function normalizeAiProvider(value: unknown, legacyMode = ''): AiProvider {
	if (value === 'free' || value === 'proxy' || value === 'custom') return value;
	if (legacyMode === 'ai-pro') return 'custom';
	if (legacyMode === 'ai') return 'proxy';
	return DEFAULT_AI_PROVIDER;
}

export function normalizeDelaySeconds(value: unknown, fallback: number): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(MIN_AUTO_SOLVE_DELAY_SECONDS, Math.round(n));
}

export function normalizeAutoSolveMode(value: unknown, legacyEnabled: boolean): AutoSolveMode {
	if (value === 'highlight' || value === 'select' || value === 'full') return value;
	return legacyEnabled ? 'full' : 'highlight';
}

export function normalizeConfidenceThreshold(value: unknown): number {
	const numeric = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(numeric)) return DEFAULT_CONFIDENCE_THRESHOLD;
	return Math.max(0.5, Math.min(1, Math.round(numeric * 100) / 100));
}

/** Privacy-safe opt-in: только явно сохранённый boolean true даёт согласие. */
export function normalizeTestDataSharingEnabled(value: unknown): boolean {
	return value === true;
}
