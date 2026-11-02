import React, {useEffect, useState} from 'react';
import {sourceHealth} from '../utils/source-health';

export default function SourceStatus() {
	const [items, setItems] = useState(() => sourceHealth.snapshot());
	useEffect(() => {
		const timer = window.setInterval(() => setItems(sourceHealth.snapshot()), 2000);
		return () => window.clearInterval(timer);
	}, []);
	return (
		<details className="nmo-base-details">
			<summary>Состояние источников</summary>
			<div className="nmo-base-details-body">
				<p className="nmo-base-subnote">Запросы в этой вкладке. Доступность сайта не означает, что ответ найден.</p>
				{!items.length && <p className="nmo-base-subnote">Запросов ещё не было</p>}
				{items.map(item => (
					<div className="nmo-base-record" key={item.host}>
						<strong className="nmo-base-record-question">{item.host}</strong>
						<p className="nmo-base-record-meta">
							{item.lastResult} · {item.averageDurationMs} мс{!item.available ? ' · временная пауза после сбоев' : ''}
						</p>
					</div>
				))}
			</div>
		</details>
	);
}
