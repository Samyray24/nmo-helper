import {useEffect, useState} from 'react';

export type PanelTheme = 'dark' | 'light';

const THEME_CHANGE_EVENT = 'nmo-theme-change';
let currentTheme: PanelTheme = 'dark';

export function normalizePanelTheme(value: unknown): PanelTheme {
	return value === 'light' ? 'light' : 'dark';
}

export function getActivePanelTheme(): PanelTheme {
	if (typeof document !== 'undefined') {
		const attr = document.getElementById('nmo-panel')?.getAttribute('data-theme');
		if (attr === 'light' || attr === 'dark') return attr;
	}
	return currentTheme;
}

export function applyPanelTheme(theme: PanelTheme): void {
	currentTheme = theme;
	if (typeof document !== 'undefined') {
		document.getElementById('nmo-panel')?.setAttribute('data-theme', theme);
	}
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent<PanelTheme>(THEME_CHANGE_EVENT, {detail: theme}));
	}
}

export function useActiveTheme(): PanelTheme {
	const [theme, setTheme] = useState<PanelTheme>(() => getActivePanelTheme());

	useEffect(() => {
		setTheme(getActivePanelTheme());
		const onThemeChange = (event: Event): void => {
			const detail = (event as CustomEvent<PanelTheme>).detail;
			setTheme(normalizePanelTheme(detail ?? getActivePanelTheme()));
		};
		window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
		return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
	}, []);

	return theme;
}
