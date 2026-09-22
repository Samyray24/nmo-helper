import {AI_URL} from '../../utils/constants';
import {buildPrompt, getApiModel} from '../../components/SectionAi/utils';
import {fetchViaBackground, type IRequestResponse} from './fetch';

/** Необязательные параметры конкретного AI-провайдера. */
export interface IAiRequestOptions {
	/** Клиентский таймаут background-fetch в миллисекундах. */
	readonly timeoutMs?: number;
	/** Лимит выходных токенов для OpenAI-совместимых endpoint'ов. */
	readonly maxTokens?: number;
	/** Дополнительные поля JSON-тела, например серверный timeout AI Horde. */
	readonly extraBody?: Readonly<Record<string, unknown>>;
}

/**
 * Отправляет вопрос теста в LLM через ProxyAPI (или кастомный endpoint) и
 * возвращает номера правильных вариантов.
 *
 * Модель получает system-prompt «ты врач-эксперт по теме X» и просит вернуть
 * номера ответов через запятую. Принимается только список допустимых номеров;
 * пояснения и несколько ответов на вопрос с одним выбором отклоняются.
 *
 * @param apiKey   Bearer-токен ProxyAPI или кастомного endpoint.
 * @param question Текст вопроса.
 * @param options  Варианты ответа в порядке, в котором они показаны пользователю.
 * @param isSingle `true` — ровно один правильный; `false` — допускается несколько.
 * @param topic    Название темы курса. Пустая строка — без темы в system-prompt.
 * @param model    ID модели (`gpt-5.4-mini`, `claude-sonnet-5`, `gemini-3.5-flash` и т.д.).
 * @param endpoint Необязательный кастомный URL (например, self-hosted OpenAI-совместимый).
 *                 Если указан, модель шлётся как есть, без префикса провайдера.
 * @returns Массив 0-индексированных номеров вариантов, помеченных моделью как правильные.
 *          Пустой массив — если формат или номера ответа недопустимы.
 * @throws {Error} `ошибка сети` — сетевой сбой.
 * @throws {Error} `неверный API-ключ` — HTTP 401/403.
 * @throws {Error} `нет средств на балансе` — HTTP 402.
 * @throws {Error} `лимит запросов — подождите` — HTTP 429.
 * @throws {Error} `ошибка <status>` — любой другой не-2xx HTTP-статус.
 */
export async function askAI(apiKey: string, question: string, options: string[], isSingle: boolean, topic: string, model: string, endpoint?: string, requestOptions: IAiRequestOptions = {}): Promise<number[]> {
	const { systemPrompt, userPrompt } = buildPrompt(question, options, isSingle, topic);
	const { url, init } = buildRequest(apiKey, model, systemPrompt, userPrompt, endpoint, requestOptions);

	const res: IRequestResponse = await fetchViaBackground(url, init);

	if (res.error) {
		if (res.message?.startsWith('таймаут')) throw new Error(`${res.message} — попробуйте ещё раз`);
		throw new Error('ошибка сети');
	}
	if (res.status < 200 || res.status >= 400) handleError(res);

	const parsed = parseAnswer(res);
	if (parsed.some(index => !Number.isInteger(index) || index < 0 || index >= options.length)) return [];
	const indexes = normalizeAnswerIndexes(parsed, options.length);
	return isSingle && indexes.length !== 1 ? [] : indexes;
}

/**
 * Проверяет, что API-ключ валиден: шлёт минимальный chat-completion
 * (одно сообщение «Ответь OK», `max_completion_tokens: 5`) и смотрит на статус.
 *
 * HTTP 429 (rate limit) трактуется как валидный ключ — раз сервер применил
 * лимит именно к этому ключу, значит он его опознал.
 *
 * @param apiKey   Bearer-токен для проверки.
 * @param model    Модель, на которой тестируется ключ. Должна быть доступна на endpoint'е.
 * @param endpoint Кастомный URL. По умолчанию используется {@link AI_URL} (ProxyAPI).
 * @returns `true`, если ключ принят сервером (включая 2xx и 429).
 * @throws {Error} `ошибка сети` — сетевой сбой.
 * @throws {Error} `неверный API-ключ` — HTTP 401/403.
 * @throws {Error} `ошибка <status>` — любой другой не-2xx статус (кроме 429).
 */
export async function validateApiKey(apiKey: string, model: string, endpoint?: string): Promise<boolean> {
	const res: IRequestResponse = await fetchViaBackground(endpoint || AI_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + apiKey,
		},
		body: JSON.stringify({
			model: endpoint ? model : getApiModel(model),
			messages: [{ role: 'user', content: 'Ответь OK' }],
			max_completion_tokens: 5,
		}),
	});
	if (res.error) throw new Error('ошибка сети');
	if (res.status === 401 || res.status === 403) {
		console.error(`NMO AI [${res.status}]:`, res.text);
		throw new Error('неверный API-ключ');
	}
	if (res.status === 429) return true;
	if (res.status < 200 || res.status >= 400) {
		console.error(`NMO AI [${res.status}]:`, res.text);
		throw new Error('ошибка ' + res.status);
	}
	return true;
}

/**
 * Собирает URL и `RequestInit` для chat-completion запроса.
 *
 * `temperature` намеренно не задаётся: она не нужна для ответа одним номером,
 * а новые Claude отклоняют её нестандартное значение с HTTP 400. Для кастомного
 * endpoint'а модель шлётся как есть, без префикса провайдера
 * (см. {@link getApiModel}).
 *
 * @param apiKey       Bearer-токен.
 * @param model        ID модели.
 * @param systemPrompt Системный промпт (см. {@link buildPrompt}).
 * @param userPrompt   Пользовательский промпт (см. {@link buildPrompt}).
 * @param endpoint     Необязательный кастомный URL; по умолчанию — {@link AI_URL}.
 * @returns `{ url, init }` для передачи в {@link fetchViaBackground}.
 */
export function buildRequest(apiKey: string, model: string, systemPrompt: string, userPrompt: string, endpoint?: string, requestOptions: IAiRequestOptions = {}) {
	const body: Record<string, unknown> = {
		...requestOptions.extraBody,
		model: endpoint ? model : getApiModel(model),
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		],
	};
	if (requestOptions.maxTokens !== undefined) body.max_tokens = requestOptions.maxTokens;

	const headers: Record<string, string> = {'Content-Type': 'application/json'};
	if (apiKey) headers.Authorization = 'Bearer ' + apiKey;

	return {
		url: endpoint || AI_URL,
		init: {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			timeoutMs: requestOptions.timeoutMs,
		},
	};
}

/**
 * Маппит неуспешный HTTP-ответ ProxyAPI в осмысленное исключение для UI.
 * Детали сервера (`error.message` из JSON-тела, либо raw-текст) логирует
 * в `console.error` для отладки.
 *
 * Никогда не возвращается нормально — тип `never` это отражает.
 *
 * @param res Ответ от {@link fetchViaBackground} со статусом вне `[200, 400)`.
 * @throws {Error} `неверный API-ключ` — 401/403.
 * @throws {Error} `нет средств на балансе` — 402.
 * @throws {Error} `лимит запросов — подождите` — 429.
 * @throws {Error} `ошибка <status>` — любой другой статус.
 */
export function handleError(res: IRequestResponse): never {
	let detail: string;
	try {
		const json = JSON.parse(res.text);
		detail = json?.error?.message || json?.detail || json?.message || res.text;
	} catch { detail = res.text; }
	console.error(`NMO AI [${res.status}]:`, detail);
	if (res.status === 401 || res.status === 403) throw new Error('неверный API-ключ');
	if (res.status === 402) throw new Error('нет средств на балансе');
	if (res.status === 429) throw new Error('лимит запросов — подождите');
	if (res.status === 406 && /timed out|timeout/i.test(detail)) throw new Error('таймаут очереди — попробуйте ещё раз');
	if (res.status === 406 && /not possible|not enough generations/i.test(detail)) throw new Error('нет доступного AI-узла — попробуйте позже');
	throw new Error(`ошибка ${res.status}`);
}

/** Удаляет повторы и числа, которые не соответствуют вариантам на странице. */
export function normalizeAnswerIndexes(indexes: number[], optionCount: number): number[] {
	return [...new Set(indexes.filter(index => index >= 0 && index < optionCount))];
}

/**
 * Достаёт номера правильных ответов из успешного chat-completion.
 *
 * Принимает только полный список номеров, в том числе с коротким префиксом
 * «Ответы» или в блоке кода. Пояснения с числами отклоняются целиком.
 *
 * @param res Ответ от {@link fetchViaBackground} с 2xx-статусом.
 * @returns Массив 0-индексированных номеров вариантов.
 */
export function parseAnswer(res: IRequestResponse): number[] {
	const data = JSON.parse(res.text);
	const content: unknown = data?.choices?.[0]?.message?.content;
	if (typeof content !== 'string') return [];
	const text = content.trim().replace(/^```(?:text)?\s*\n([\s\S]*?)\n```$/i, '$1').trim();
	const list = text.match(/^(?:(?:правильн(?:ый|ые)\s+)?(?:ответы?|варианты?|answers?)\s*[:—-]?\s*)?(\d+(?:\s*(?:[,;]|и|and)\s*\d+)*)[.!]?$/i)?.[1];
	if (!list) return [];
	return (list.match(/\d+/g) ?? []).map(n => Number(n) - 1);
}
