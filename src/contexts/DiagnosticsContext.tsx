import React, {createContext, useContext, useMemo, useState} from 'react';

interface IDiagnosticsContext {readonly open: boolean; readonly setOpen: (open: boolean) => void}
const Context = createContext<IDiagnosticsContext>({open: false, setOpen: () => undefined});

export const DiagnosticsProvider: React.FC<React.PropsWithChildren> = ({children}) => {
	const [open, setOpen] = useState(false);
	const value = useMemo(() => ({open, setOpen}), [open]);
	return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useDiagnosticsDialog = () => useContext(Context);
