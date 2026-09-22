import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ensureHostPermission, toPermissionOrigin} from './host-permissions';

describe('toPermissionOrigin', () => {
	it('оставляет только HTTPS origin', () => {
		expect(toPermissionOrigin('https://api.example.com/v1/chat?q=1')).toBe('https://api.example.com/*');
		expect(toPermissionOrigin('https://api.example.com:8443/v1')).toBe('https://api.example.com:8443/*');
	});

	it('отклоняет небезопасные и некорректные адреса', () => {
		expect(() => toPermissionOrigin('http://api.example.com/v1')).toThrow('HTTPS');
		expect(() => toPermissionOrigin('not-a-url')).toThrow('некорректный');
	});
});

describe('ensureHostPermission', () => {
	const contains = vi.fn();
	const request = vi.fn();

	beforeEach(() => {
		contains.mockReset();
		request.mockReset();
		Object.assign(chrome, {permissions: {contains, request}});
	});

	it('запрашивает только origin указанного endpoint и возвращает отказ', async () => {
		contains.mockImplementation((_permission, callback) => callback(false));
		request.mockImplementation((_permission, callback) => callback(false));
		await expect(ensureHostPermission('https://api.example.com/v1/chat')).resolves.toBe(false);
		expect(request).toHaveBeenCalledWith({origins: ['https://api.example.com/*']}, expect.any(Function));
	});

	it('не показывает повторный запрос, когда доступ уже выдан', async () => {
		contains.mockImplementation((_permission, callback) => callback(true));
		await expect(ensureHostPermission('https://api.example.com/v1/chat')).resolves.toBe(true);
		expect(request).not.toHaveBeenCalled();
	});
});
