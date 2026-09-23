import React, {useEffect, useState} from 'react';
import {storageGet, storageSet} from '../api/storage';

export default function ThemeToggle() {
	const [theme, setTheme] = useState('dark');
	useEffect(() => { let active = true; void storageGet('panelTheme', 'dark').then(value => {
		if (active) setTheme(value === 'light' ? 'light' : 'dark');
	}); return () => { active = false; }; }, []);
	useEffect(() => { document.getElementById('nmo-panel')?.setAttribute('data-theme', theme); }, [theme]);
	return <button type="button" className="nmo-icon-btn" title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
		aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} onClick={() => {
			const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); storageSet('panelTheme', next);
		}}>{theme === 'dark' ? '☀' : '☾'}</button>;
}
