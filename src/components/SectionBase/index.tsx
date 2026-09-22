import React, {useEffect, useRef, useState} from 'react';
import {localAnswerDb, type ILocalBaseStats, type IUnknownQuestionRecord} from '../../utils/local-answer-db';
import {parseLocalBaseFile, serializeLocalBase, serializeUnknownQuestions} from '../../utils/local-base-import';
import './styles.scss';

const EMPTY_STATS: ILocalBaseStats = {answers: 0, unknown: 0, backend: 'memory'};

const SectionBase: React.FC = () => {
	const [stats, setStats] = useState(EMPTY_STATS);
	const [unknown, setUnknown] = useState<IUnknownQuestionRecord[]>([]);
	const [file, setFile] = useState<File | null>(null);
	const [message, setMessage] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const refresh = async (): Promise<void> => {
		const [nextStats, nextUnknown] = await Promise.all([localAnswerDb.stats(), localAnswerDb.listUnknown()]);
		setStats(nextStats);
		setUnknown(nextUnknown);
	};
	useEffect(() => { void refresh(); }, []);

	const importFile = async (mode: 'merge' | 'replace'): Promise<void> => {
		if (!file) return setMessage('Сначала выберите JSON, CSV или ZIP');
		try {
			const records = await parseLocalBaseFile(file);
			await localAnswerDb[mode](records);
			setMessage(`${mode === 'replace' ? 'Загружено' : 'Добавлено'} записей: ${records.length}`);
			await refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : 'Не удалось импортировать файл');
		}
	};

	return <div className="nmo-section nmo-base-section">
		<div className="nmo-section-inner">
			<div className="nmo-base-summary">
				<div><strong>{stats.answers}</strong><span>ответов локально</span></div>
				<div><strong>{stats.unknown}</strong><span>неизвестных</span></div>
			</div>
			<p className="nmo-base-note">Локальная база работает без сети и остаётся только в этом браузере.</p>
			<input ref={inputRef} className="nmo-base-file" type="file" accept=".json,.csv,.zip"
				onChange={event => setFile(event.currentTarget.files?.[0] ?? null)}/>
			<button type="button" className="nmo-base-file-button" onClick={() => inputRef.current?.click()}>
				{file ? file.name : 'Выбрать базу JSON, CSV или ZIP'}
			</button>
			<div className="nmo-base-actions">
				<button type="button" onClick={() => void importFile('merge')}>Добавить</button>
				<button type="button" onClick={() => void importFile('replace')}>Заменить</button>
			</div>
			{message && <div className="nmo-base-message" role="status">{message}</div>}
			<details className="nmo-base-details">
				<summary>Управление данными</summary>
				<div className="nmo-base-actions vertical">
					<button type="button" onClick={() => void localAnswerDb.listAnswers().then(records => download('nmo-local-base.json', serializeLocalBase(records)))}>Экспортировать базу</button>
					<button type="button" disabled={!unknown.length} onClick={() => download('nmo-unknown-questions.json', serializeUnknownQuestions(unknown))}>Экспортировать неизвестные</button>
					<button type="button" className="danger" onClick={() => void localAnswerDb.clear('all').then(refresh)}>Очистить локальные данные</button>
				</div>
			</details>
			{unknown.length > 0 && <details className="nmo-base-details">
				<summary>Последние неизвестные вопросы</summary>
				<div className="nmo-base-unknown">{unknown.slice(-20).reverse().map(record => <div key={record.id ?? record.question}>{record.question}</div>)}</div>
			</details>}
			<div className="nmo-base-backend">Хранилище: {stats.backend === 'indexeddb' ? 'IndexedDB' : 'резервная память'}</div>
		</div>
	</div>;
};

export default SectionBase;

function download(filename: string, contents: string): void {
	const url = URL.createObjectURL(new Blob([contents], {type: 'application/json;charset=utf-8'}));
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
