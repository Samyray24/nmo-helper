import React, {useEffect, useState} from 'react';
import {useDiagnosticsDialog} from '../../contexts/DiagnosticsContext';
import {diagnostics} from '../../utils/diagnostics';
import {IconClose} from '../icons';
import './styles.scss';

export default function DiagnosticsDialog() {
	const {open, setOpen} = useDiagnosticsDialog();
	const [includeText, setIncludeText] = useState(false);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') setOpen(false);
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [open, setOpen]);

	if (!open) return null;
	const report = diagnostics.snapshot({includeQuestionText: includeText});

	return (
		<div className="nmo-diagnostics-backdrop" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
			<section className="nmo-diagnostics nmo-fade-up" role="dialog" aria-modal="true" aria-label="Диагностика расширения">
				<header className="nmo-diagnostics-head">
					<div>
						<strong>Диагностика</strong>
						<span>Версия {report.browser.extensionVersion}</span>
					</div>
					<button type="button" className="nmo-icon-btn" aria-label="Закрыть" onClick={() => setOpen(false)}>
						<IconClose size={13}/>
					</button>
				</header>
				<div className="nmo-diagnostics-grid">
					<StatusRow label="Браузер" value={`${report.browser.family} ${report.browser.browserVersion}`.trim()} ok={report.browser.family !== 'unknown'}/>
					<StatusRow label="Разметка НМО" value={profileLabel(report.dom.profile)} ok={report.dom.profile !== 'unknown'}/>
					<StatusRow label="Тема и вопрос" value={report.dom.topic && report.dom.question ? 'найдены' : 'не найдены'} ok={report.dom.topic && report.dom.question}/>
					<StatusRow label="Варианты" value={String(report.dom.variants)} ok={report.dom.variants > 0}/>
					<StatusRow label="Кнопка перехода" value={report.dom.nextButton ? 'найдена' : 'не найдена'} ok={report.dom.nextButton}/>
					<StatusRow label="Локальная база" value={report.storage.indexedDb ? 'доступна' : 'резервный режим'} ok={report.storage.indexedDb}/>
				</div>
				<details className="nmo-diagnostics-details">
					<summary>Последние события ({report.events.length})</summary>
					<div className="nmo-diagnostics-events">
						{report.events.slice(-25).reverse().map((event, index) => (
							<div key={`${event.at}-${index}`}>
								<span>{event.host ?? event.kind}</span>
								<code>{event.status ?? event.code}</code>
							</div>
						))}
						{!report.events.length && <p>Событий пока нет</p>}
					</div>
				</details>
				<label className="nmo-diagnostics-check">
					<input type="checkbox" checked={includeText} onChange={event => setIncludeText(event.currentTarget.checked)}/>
					<span>Добавить текст текущего вопроса в отчёт</span>
				</label>
				<button type="button" className="nmo-btn nmo-btn-ghost nmo-diagnostics-download" onClick={() => downloadReport(diagnostics.snapshot({includeQuestionText: includeText}))}>
					Скачать отчёт
				</button>
			</section>
		</div>
	);
}

const StatusRow = ({label, value, ok}: {label: string; value: string; ok: boolean}) => (
	<div className="nmo-diagnostics-row">
		<span className={ok ? 'ok' : 'warn'}/>
		<strong>{label}</strong>
		<em>{value}</em>
	</div>
);

function downloadReport(report: unknown): void {
	const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'}));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = 'nmo-helper-diagnostics.json';
	anchor.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function profileLabel(profile: 'current-material' | 'compatible' | 'unknown'): string {
	if (profile === 'current-material') return 'основная';
	if (profile === 'compatible') return 'резервная';
	return 'не распознана';
}
