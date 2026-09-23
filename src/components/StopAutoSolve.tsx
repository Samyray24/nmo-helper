import React from 'react';
import {useSettings} from '../contexts/SettingsContext';

export default function StopAutoSolve() {
	const {autoSolve} = useSettings();
	return <button type="button" className="nmo-chip" disabled={!autoSolve.enabled}
		title="Остановить автоматический выбор и переходы" onClick={() => autoSolve.setEnabled(false)}>Стоп</button>;
}
