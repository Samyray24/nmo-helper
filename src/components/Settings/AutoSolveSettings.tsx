import React from 'react';
import {MIN_AUTO_SOLVE_DELAY_SECONDS, useSettings} from '../../contexts/SettingsContext';

const AutoSolveSettings: React.FC = () => {

	const {
		mode,
		setMode,
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
	} = useSettings().autoSolve;

	return (
		<>
			<label className="nmo-settings-field">
				<span>Режим автоматизации</span>
				<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
					<option value="highlight">Осторожный — подсветка</option>
					<option value="select">Обычный — выбрать ответ</option>
					<option value="full">Полный — пройти тест</option>
				</select>
			</label>

			<div className="nmo-settings-section">
				<div className="nmo-settings-section-title">Интервал прохождения вопроса</div>

				<div className="nmo-settings-range">
					<label className="nmo-settings-number-field">
						<span>Мин, сек</span>
						<input type="number"
							min={MIN_AUTO_SOLVE_DELAY_SECONDS}
							step={1}
							value={autoSolveDelayMinSeconds}
							onChange={e => setAutoSolveDelayMinSeconds(e.currentTarget.valueAsNumber)}/>
					</label>

					<label className="nmo-settings-number-field">
						<span>Макс, сек</span>
						<input type="number"
							min={autoSolveDelayMinSeconds}
							step={1}
							value={autoSolveDelayMaxSeconds}
							onChange={e => setAutoSolveDelayMaxSeconds(e.currentTarget.valueAsNumber)}/>
					</label>
				</div>
			</div>
			<details className="nmo-settings-advanced">
				<summary>Дополнительные настройки</summary>
				<label className="nmo-settings-field">
					<span>Минимальная уверенность: {Math.round(confidenceThreshold * 100)}%</span>
					<input type="range" min="50" max="100" step="1" value={Math.round(confidenceThreshold * 100)}
						onChange={event => setConfidenceThreshold(Number(event.currentTarget.value) / 100)}/>
				</label>
				<label className="nmo-settings-check"><input type="checkbox" checked={aiFallbackEnabled}
					onChange={event => setAiFallbackEnabled(event.currentTarget.checked)}/>AI-резерв, если базы не помогли</label>
				<label className="nmo-settings-check"><input type="checkbox" checked={recoveryEnabled}
					onChange={event => setRecoveryEnabled(event.currentTarget.checked)}/>Восстанавливать тест после обновления</label>
			</details>
		</>
	);
};

export default AutoSolveSettings;
