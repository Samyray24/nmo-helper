import React, {useEffect, useState} from 'react';
import {localAnswerDb, type ILocalAnswerRecord} from '../../utils/local-answer-db';
import {answerCache} from '../../utils/answer-cache';

export default function BaseEditor({revision, onChange}: {revision: number; onChange: () => Promise<void>}) {
	const [records, setRecords] = useState<ILocalAnswerRecord[]>([]);
	const [query, setQuery] = useState('');
	const [limit, setLimit] = useState(20);
	const [editing, setEditing] = useState<ILocalAnswerRecord | null>(null);
	const [selected, setSelected] = useState<string[]>([]);
	const [message, setMessage] = useState('');

	useEffect(() => {
		let active = true;
		void localAnswerDb.listAnswers().then(items => { if (active) setRecords(items ?? []); });
		return () => { active = false; };
	}, [revision]);

	const filtered = records.filter(record => `${record.topic} ${record.question}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

	const mutate = async (action: () => Promise<void>) => {
		try {
			await action();
			answerCache.clear();
			setEditing(null);
			await onChange();
			setMessage('Изменения сохранены');
		} catch {
			setMessage('Не удалось сохранить изменения');
		}
	};

	return (
		<details className="nmo-base-details">
			<summary>Поиск и редактор ответов</summary>
			<div className="nmo-base-details-body">
				<input
					className="nmo-input nmo-base-search"
					aria-label="Поиск по локальной базе"
					placeholder="Тема или вопрос"
					value={query}
					onChange={event => { setQuery(event.target.value); setLimit(20); }}/>
				<p className="nmo-base-count">{filtered.length} записей</p>
				{message && <p className="nmo-base-message" role="status">{message}</p>}
				{filtered.slice(0, limit).map(record => (
					<div className="nmo-base-record" key={record.id}>
						<strong className="nmo-base-record-question">{record.question}</strong>
						<p className="nmo-base-record-topic">{record.topic}</p>
						<p className="nmo-base-record-meta">
							{record.source ?? 'Происхождение не указано'} · {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString('ru') : 'Дата неизвестна'}
						</p>
						<p className="nmo-base-record-answer">Ответ: {record.answers.join('; ')}</p>
						{!!record.conflicts?.length && (
							<p className="nmo-base-record-conflict" role="status">
								Противоречие: {record.conflicts.map(group => group.join('; ')).join(' / ')}
							</p>
						)}
						{editing?.id === record.id ? (
							<fieldset className="nmo-base-fieldset">
								<legend>Выберите правильные ответы</legend>
								{record.variants.map((variant, index) => (
									<label className="nmo-base-choice" key={index}>
										<input
											type="checkbox"
											checked={selected.includes(variant)}
											onChange={event => setSelected(event.target.checked ? [...selected, variant] : selected.filter(item => item !== variant))}/>
										<span>{variant}</span>
									</label>
								))}
								<div className="nmo-base-actions">
									<button
										type="button"
										className="primary"
										disabled={!selected.length}
										onClick={() => void mutate(() => localAnswerDb.merge([{...record, answers: selected, conflicts: [], source: 'Проверено вручную', updatedAt: Date.now()}], true))}>
										Сохранить
									</button>
									<button type="button" onClick={() => setEditing(null)}>Отмена</button>
								</div>
							</fieldset>
						) : (
							<div className="nmo-base-actions">
								<button type="button" onClick={() => { setEditing(record); setSelected([...record.answers]); }}>Изменить</button>
								<button type="button" className="danger" onClick={() => { if (window.confirm('Удалить этот ответ из локальной базы?')) void mutate(() => localAnswerDb.remove(record.id!)); }}>Удалить</button>
							</div>
						)}
					</div>
				))}
				{filtered.length > limit && (
					<button type="button" className="nmo-base-more" onClick={() => setLimit(limit + 20)}>
						Ещё 20
					</button>
				)}
			</div>
		</details>
	);
}
