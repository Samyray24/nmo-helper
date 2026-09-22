import {beforeEach, describe, expect, it} from 'vitest';
import {clearCredentialMemory, credentialGet, credentialSet} from './credential-storage';
import {storageGet, storageSet} from './storage';

beforeEach(() => clearCredentialMemory());

describe('credential storage', () => {
	it('мигрирует старый токен из local в session', async () => {
		storageSet('legacy-token', 'secret');
		await expect(credentialGet('legacy-token')).resolves.toBe('secret');
		await expect(storageGet('legacy-token', '')).resolves.toBe('');
		await expect(credentialGet('legacy-token')).resolves.toBe('secret');
	});

	it('не записывает новый токен в local storage', async () => {
		await credentialSet('new-token', 'value');
		await expect(credentialGet('new-token')).resolves.toBe('value');
		await expect(storageGet('new-token', '')).resolves.toBe('');
	});

	it('сохраняет токен в extension storage на Firefox ESR без storage.session', async () => {
		const session = chrome.storage.session;
		Object.defineProperty(chrome.storage, 'session', {value: undefined, configurable: true});
		try {
			await credentialSet('esr-token', 'persistent');
			clearCredentialMemory();
			await expect(credentialGet('esr-token')).resolves.toBe('persistent');
		} finally {
			Object.defineProperty(chrome.storage, 'session', {value: session, configurable: true});
		}
	});
});
