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
	useEffect(() => { let active = true; void localAnswerDb.listAnswers().then(items => { if (active) setRecords(items ?? []); }); return () => { active = false; }; }, [revision]);
	const filtered = records.filter(record => `${record.topic} ${record.question}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
	const mutate = async (action: () => Promise<void>) => {
		try { await action(); answerCache.clear(); setEditing(null); await onChange(); setMessage('Изменения сохранены'); }
		catch { setMessage('Не удалось сохранить изменения'); }
	};
	return <details className="nmo-base-details"><summary>Поиск и редактор ответов</summary>
		<input className="nmo-input" aria-label="Поиск по локальной базе" placeholder="Тема или вопрос" value={query} onChange={event => { setQuery(event.target.value); setLimit(20); }}/>
		<p>{filtered.length} записей</p>
		{message && <p role="status">{message}</p>}
		{filtered.slice(0, limit).map(record => <div className="nmo-base-record" key={record.id}>
			<strong>{record.question}</strong><p>{record.topic}</p>
			<p>{record.source ?? 'Происхождение не указано'} · {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString('ru') : 'Дата неизвестна'}</p>
			<p>Ответ: {record.answers.join('; ')}</p>
			{!!record.conflicts?.length && <p role="status">Противоречие: {record.conflicts.map(group => group.join('; ')).join(' / ')}</p>}
			{editing?.id === record.id ? <fieldset><legend>Выберите правильные ответы</legend>
				{record.variants.map((variant, index) => <label className="nmo-base-choice" key={index}><input type="checkbox" checked={selected.includes(variant)} onChange={event => setSelected(event.target.checked ? [...selected, variant] : selected.filter(item => item !== variant))}/>{variant}</label>)}
				<button type="button" disabled={!selected.length} onClick={() => void mutate(() => localAnswerDb.merge([{...record, answers: selected, conflicts: [], source: 'Проверено вручную', updatedAt: Date.now()}], true))}>Сохранить</button>
				<button type="button" onClick={() => setEditing(null)}>Отмена</button>
			</fieldset> : <div className="nmo-base-actions">
				<button type="button" onClick={() => { setEditing(record); setSelected([...record.answers]); }}>Изменить</button>
				<button type="button" onClick={() => { if (window.confirm('Удалить этот ответ из локальной базы?')) void mutate(() => localAnswerDb.remove(record.id!)); }}>Удалить</button>
			</div>}
		</div>)}
		{filtered.length > limit && <button type="button" onClick={() => setLimit(limit + 20)}>Ещё 20</button>}
	</details>;
}
