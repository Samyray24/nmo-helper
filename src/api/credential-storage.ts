const memoryCredentials = new Map<string, string>();

/**
 * Reads an AI credential from browser-session storage. Legacy values from
 * local storage are migrated once and removed from persistent storage.
 */
export async function credentialGet(key: string): Promise<string> {
	const sessionArea = getSessionArea();
	if (sessionArea) {
		const sessionValue = await readArea(sessionArea, key);
		if (typeof sessionValue === 'string') return sessionValue;
		const legacyValue = await readArea(chrome.storage?.local, key);
		if (typeof legacyValue === 'string' && legacyValue) {
			await writeArea(sessionArea, key, legacyValue);
			removeLocal(key);
			return legacyValue;
		}
		return memoryCredentials.get(key) ?? '';
	}

	// Firefox ESR 102 has no storage.session. Keep credentials in extension-only
	// local storage there so a page refresh does not silently disable AI.
	const legacyValue = await readArea(chrome.storage?.local, key);
	if (typeof legacyValue === 'string') return legacyValue;
	return memoryCredentials.get(key) ?? '';
}

/** Stores credentials for the browser session; Firefox ESR uses extension-only local storage. */
export async function credentialSet(key: string, value: string): Promise<void> {
	memoryCredentials.set(key, value);
	const sessionArea = getSessionArea();
	if (sessionArea) {
		await writeArea(sessionArea, key, value);
		removeLocal(key);
		return;
	}
	await writeArea(chrome.storage?.local, key, value);
}

export function clearCredentialMemory(): void { memoryCredentials.clear(); }

function readArea(area: chrome.storage.StorageArea | undefined, key: string): Promise<unknown> {
	if (!area) return Promise.resolve(undefined);
	return new Promise(resolve => {
		try { area.get(key, result => resolve(result?.[key])); } catch { resolve(undefined); }
	});
}

function writeArea(area: chrome.storage.StorageArea | undefined, key: string, value: string): Promise<void> {
	if (!area) return Promise.resolve();
	return new Promise(resolve => {
		try { area.set({[key]: value}, resolve); } catch { resolve(); }
	});
}

function getSessionArea(): chrome.storage.StorageArea | undefined {
	return (chrome.storage as unknown as {session?: chrome.storage.StorageArea})?.session;
}

function removeLocal(key: string): void {
	try { chrome.storage?.local?.remove?.(key); } catch { /* old browser context */ }
}
