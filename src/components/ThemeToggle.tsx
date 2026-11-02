import React, {useEffect, useState} from 'react';
import {storageGet, storageSet} from '../api/storage';
import {applyPanelTheme, normalizePanelTheme, type PanelTheme} from '../utils/theme';
import {IconMoon, IconSun} from './icons';

export default function ThemeToggle() {
	const [theme, setTheme] = useState<PanelTheme>('dark');

	useEffect(() => {
		let active = true;
		void storageGet('panelTheme', 'dark').then(value => {
			if (active) setTheme(normalizePanelTheme(value));
		});
		return () => { active = false; };
	}, []);

	useEffect(() => {
		applyPanelTheme(theme);
	}, [theme]);

	const label = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';

	return (
		<button
			type="button"
			className="nmo-icon-btn"
			title={label}
			aria-label={label}
			onClick={() => {
				const next: PanelTheme = theme === 'dark' ? 'light' : 'dark';
				setTheme(next);
				storageSet('panelTheme', next);
			}}>
			{theme === 'dark' ? <IconSun size={14}/> : <IconMoon size={14}/>}
		</button>
	);
}
