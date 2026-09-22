import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';

export type AutoSolvePhase =
	| 'disabled'
	| 'idle'
	| 'waiting'
	| 'paused'
	| 'selecting'
	| 'moving'
	| 'finishing'
	| 'complete'
	| 'error';

export interface IAutoSolveStatus {
	readonly phase: AutoSolvePhase;
	readonly message: string;
	readonly secondsRemaining: number | null;
}

interface IAutoSolveStatusContext {
	readonly status: IAutoSolveStatus;
	readonly setStatus: (status: IAutoSolveStatus) => void;
}

const DISABLED_STATUS: IAutoSolveStatus = {
	phase: 'disabled',
	message: 'Автопрохождение выключено',
	secondsRemaining: null,
};

const AutoSolveStatusContext = createContext<IAutoSolveStatusContext>({
	status: DISABLED_STATUS,
	setStatus: () => undefined,
});

export const AutoSolveStatusProvider: React.FC<React.PropsWithChildren> = ({children}) => {
	const [status, setStatusRaw] = useState<IAutoSolveStatus>(DISABLED_STATUS);
	const setStatus = useCallback((next: IAutoSolveStatus): void => {
		setStatusRaw(current => current.phase === next.phase
			&& current.message === next.message
			&& current.secondsRemaining === next.secondsRemaining
			? current
			: next);
	}, []);
	const value = useMemo(() => ({status, setStatus}), [status, setStatus]);

	return <AutoSolveStatusContext.Provider value={value}>{children}</AutoSolveStatusContext.Provider>;
};

export const useAutoSolveStatus = () => useContext(AutoSolveStatusContext);
