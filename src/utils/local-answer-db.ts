import {questionFingerprint} from './question-fingerprint';

const DB_NAME = 'nmo-helper-local-answers';
const DB_VERSION = 1;
const ANSWERS_STORE = 'answers';
const UNKNOWN_STORE = 'unknown';
const MAX_MEMORY_RECORDS = 5000;

export interface ILocalAnswerRecord {
	readonly id?: string;
	readonly topic: string;
	readonly question: string;
	readonly variants: string[];
	readonly answers: string[];
	readonly updatedAt?: number;
}

export interface IUnknownQuestionRecord {
	readonly id?: string;
	readonly topic: string;
	readonly question: string;
	readonly variants: string[];
	readonly addedAt?: number;
}

export interface ILocalBaseStats {
	readonly answers: number;
	readonly unknown: number;
	readonly backend: 'indexeddb' | 'memory';
}

class LocalAnswerDb {
	private dbPromise: Promise<IDBDatabase> | null = null;
	private memoryOnly = typeof indexedDB === 'undefined';
	private readonly memoryAnswers = new Map<string, Required<ILocalAnswerRecord>>();
	private readonly memoryUnknown = new Map<string, Required<IUnknownQuestionRecord>>();

	public async find(topic: string, question: string, variants: string[]): Promise<ILocalAnswerRecord | null> {
		const id = questionFingerprint(topic, question, variants);
		const record = await this.get<Required<ILocalAnswerRecord>>(ANSWERS_STORE, id);
		return record ? cloneAnswer(record) : null;
	}

	public async replace(records: readonly ILocalAnswerRecord[]): Promise<void> {
		const normalized = records.map(normalizeAnswer);
		if (this.memoryOnly) {
			this.memoryAnswers.clear();
			for (const record of normalized.slice(-MAX_MEMORY_RECORDS)) this.memoryAnswers.set(record.id, record);
			return;
		}
		try {
			const db = await this.open();
			await transactionDone(db, ANSWERS_STORE, 'readwrite', store => {
				store.clear();
				for (const record of normalized) store.put(record);
			});
		} catch {
			this.useMemory();
			await this.replace(records);
		}
	}

	public async merge(records: readonly ILocalAnswerRecord[]): Promise<void> {
		const normalized = records.map(normalizeAnswer);
		if (this.memoryOnly) {
			for (const record of normalized) this.memoryAnswers.set(record.id, record);
			trimMap(this.memoryAnswers);
			return;
		}
		try {
			const db = await this.open();
			await transactionDone(db, ANSWERS_STORE, 'readwrite', store => {
				for (const record of normalized) store.put(record);
			});
		} catch {
			this.useMemory();
			await this.merge(records);
		}
	}

	public async listAnswers(): Promise<ILocalAnswerRecord[]> {
		return (await this.getAll<Required<ILocalAnswerRecord>>(ANSWERS_STORE)).map(cloneAnswer);
	}

	public async addUnknown(record: IUnknownQuestionRecord): Promise<void> {
		const normalized = normalizeUnknown(record);
		if (this.memoryOnly) {
			this.memoryUnknown.set(normalized.id, normalized);
			trimMap(this.memoryUnknown);
			return;
		}
		try {
			const db = await this.open();
			await transactionDone(db, UNKNOWN_STORE, 'readwrite', store => store.put(normalized));
		} catch {
			this.useMemory();
			await this.addUnknown(record);
		}
	}

	public async listUnknown(): Promise<IUnknownQuestionRecord[]> {
		return (await this.getAll<Required<IUnknownQuestionRecord>>(UNKNOWN_STORE)).map(record => ({...record, variants: [...record.variants]}));
	}

	public async clear(kind: 'answers' | 'unknown' | 'all' = 'all'): Promise<void> {
		const stores = kind === 'all' ? [ANSWERS_STORE, UNKNOWN_STORE] : [kind];
		if (this.memoryOnly) {
			if (stores.includes(ANSWERS_STORE)) this.memoryAnswers.clear();
			if (stores.includes(UNKNOWN_STORE)) this.memoryUnknown.clear();
			return;
		}
		try {
			const db = await this.open();
			await Promise.all(stores.map(storeName => transactionDone(db, storeName, 'readwrite', store => store.clear())));
		} catch {
			this.useMemory();
			await this.clear(kind);
		}
	}

	public async stats(): Promise<ILocalBaseStats> {
		const [answers, unknown] = await Promise.all([this.count(ANSWERS_STORE), this.count(UNKNOWN_STORE)]);
		return {answers, unknown, backend: this.memoryOnly ? 'memory' : 'indexeddb'};
	}

	private async get<T>(storeName: string, id: string): Promise<T | null> {
		if (this.memoryOnly) return ((storeName === ANSWERS_STORE ? this.memoryAnswers : this.memoryUnknown).get(id) as T | undefined) ?? null;
		try {
			const db = await this.open();
			return await requestResult<T | undefined>(db.transaction(storeName).objectStore(storeName).get(id)) ?? null;
		} catch {
			this.useMemory();
			return this.get<T>(storeName, id);
		}
	}

	private async getAll<T>(storeName: string): Promise<T[]> {
		if (this.memoryOnly) return [...(storeName === ANSWERS_STORE ? this.memoryAnswers : this.memoryUnknown).values()] as T[];
		try {
			const db = await this.open();
			return await requestResult<T[]>(db.transaction(storeName).objectStore(storeName).getAll());
		} catch {
			this.useMemory();
			return this.getAll<T>(storeName);
		}
	}

	private async count(storeName: string): Promise<number> {
		if (this.memoryOnly) return (storeName === ANSWERS_STORE ? this.memoryAnswers : this.memoryUnknown).size;
		try {
			const db = await this.open();
			return await requestResult<number>(db.transaction(storeName).objectStore(storeName).count());
		} catch {
			this.useMemory();
			return this.count(storeName);
		}
	}

	private open(): Promise<IDBDatabase> {
		if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(ANSWERS_STORE)) db.createObjectStore(ANSWERS_STORE, {keyPath: 'id'});
				if (!db.objectStoreNames.contains(UNKNOWN_STORE)) db.createObjectStore(UNKNOWN_STORE, {keyPath: 'id'});
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		return this.dbPromise;
	}

	private useMemory(): void {
		this.memoryOnly = true;
		this.dbPromise = null;
	}
}

export const localAnswerDb = new LocalAnswerDb();

function normalizeAnswer(record: ILocalAnswerRecord): Required<ILocalAnswerRecord> {
	return {
		id: questionFingerprint(record.topic, record.question, record.variants),
		topic: record.topic.trim(), question: record.question.trim(),
		variants: record.variants.map(value => value.trim()), answers: record.answers.map(value => value.trim()),
		updatedAt: record.updatedAt ?? Date.now(),
	};
}

function normalizeUnknown(record: IUnknownQuestionRecord): Required<IUnknownQuestionRecord> {
	return {
		id: questionFingerprint(record.topic, record.question, record.variants),
		topic: record.topic.trim(), question: record.question.trim(), variants: record.variants.map(value => value.trim()),
		addedAt: record.addedAt ?? Date.now(),
	};
}

function cloneAnswer(record: Required<ILocalAnswerRecord>): ILocalAnswerRecord {
	return {...record, variants: [...record.variants], answers: [...record.answers]};
}

function trimMap<T>(map: Map<string, T>): void {
	while (map.size > MAX_MEMORY_RECORDS) map.delete(map.keys().next().value!);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionDone(db: IDBDatabase, storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, mode);
		action(transaction.objectStore(storeName));
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);
	});
}
