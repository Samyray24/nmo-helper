import React from 'react';
import cn from 'classnames';
import {useSettings} from '../contexts/SettingsContext';

export default function StopAutoSolve() {
	const {autoSolve} = useSettings();
	return (
		<button
			type="button"
			className={cn('nmo-chip', 'nmo-stop-chip', {active: autoSolve.enabled})}
			disabled={!autoSolve.enabled}
			title={autoSolve.enabled ? 'Остановить автоматический выбор и переходы' : 'Автопрохождение сейчас выключено'}
			onClick={() => autoSolve.setEnabled(false)}>
			Стоп
		</button>
	);
}
