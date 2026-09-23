/** Проверка стабильных выпусков в репозитории Samyray24/nmo-helper. */

import {fetchViaBackground} from './fetch/fetch';
import {storageGet, storageSet} from './storage';

const VERSION_ENDPOINT = 'https://api.github.com/repos/Samyray24/nmo-helper/releases/latest';
const CACHE_KEY = 'githubVersionCheck';

/** Максимальный возраст кэша для автоматических проверок (6 часов) */
const TTL_AUTO_MS = 6 * 60 * 60 * 1000;
/** Минимальный интервал между ручными проверками (30 секунд) */
const TTL_MANUAL_MS = 30 * 1000;

const EXT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '';

export interface IVersionInfo {
	readonly current: string;
	readonly latest: string;
	readonly unavailable?: boolean;
}

interface ICacheEntry {
	readonly checkedAt: number;
	readonly latest: string;
}

/**
 * Возвращает данные о версии расширения. По умолчанию использует кэш с
 * TTL 6 часов. При `force=true` (ручной клик) — TTL 30 секунд (анти-спам).
 *
 * При сбое возвращается признак unavailable, чтобы не утверждать актуальность версии.
 */
export async function checkVersion(force = false): Promise<IVersionInfo> {
	const cache = await storageGet<ICacheEntry | null>(CACHE_KEY, null);
	const ttl = force ? TTL_MANUAL_MS : TTL_AUTO_MS;
	const fresh = cache && Date.now() - cache.checkedAt < ttl;

	if (fresh) return {current: EXT_VERSION, latest: cache.latest};

	const res = await fetchViaBackground(VERSION_ENDPOINT, {method: 'GET', timeoutMs: 15000});

	// При сбое кэш не считается подтверждением актуальности.
	if (res.error || res.status === 429 || res.status < 200 || res.status >= 300) {
		return {current: EXT_VERSION, latest: cache?.latest ?? '', unavailable: true};
	}

	let body: {tag_name?: string; draft?: boolean; prerelease?: boolean} = {};
	try { body = JSON.parse(res.text); } catch { /* noop */ }

	const latest = typeof body.tag_name === 'string' ? body.tag_name.replace(/^v/, '').trim() : '';
	if (!/^\d+\.\d+\.\d+$/.test(latest) || body.draft || body.prerelease) return {current: EXT_VERSION, latest: '', unavailable: true};
	const entry: ICacheEntry = {checkedAt: Date.now(), latest};
	storageSet(CACHE_KEY, entry);

	return {current: EXT_VERSION, latest};
}

export function isOutdated(info: IVersionInfo): boolean {
	if (!info.current || !info.latest) return false;
	return cmp(info.current, info.latest) < 0;
}

/** Ссылка только на известные имена пакетов в нашем репозитории. */
export function releaseDownloadUrl(version: string): string {
	if (!/^\d+\.\d+\.\d+$/.test(version)) return 'https://github.com/Samyray24/nmo-helper/releases/latest';
	const manifest = chrome.runtime.getManifest?.();
	const firefox = !!manifest?.browser_specific_settings;
	const name = firefox ? `firefox${manifest?.manifest_version === 2 ? '-esr' : ''}-${version}-unsigned.xpi`
		: /YaBrowser\//.test(navigator.userAgent) ? `yandex-windows-linux-${version}.zip` : `chromium-${version}.zip`;
	return `https://github.com/Samyray24/nmo-helper/releases/download/v${version}/nmo-helper-${name}`;
}

function cmp(a: string, b: string): number {
	const pa = a.split('.').map(n => parseInt(n, 10) || 0);
	const pb = b.split('.').map(n => parseInt(n, 10) || 0);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const da = pa[i] ?? 0, db = pb[i] ?? 0;
		if (da !== db) return da < db ? -1 : 1;
	}
	return 0;
}
