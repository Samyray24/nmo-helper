/** Преобразует HTTPS endpoint в минимальный WebExtension origin pattern. */
export function toPermissionOrigin(value: string): string {
	let url: URL;
	try { url = new URL(value); } catch { throw new Error('некорректный API endpoint'); }
	if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('endpoint должен использовать HTTPS');
	return `${url.protocol}//${url.host}/*`;
}

/** Запрашивает доступ только к origin пользовательского endpoint. Вызывать из клика пользователя. */
export async function ensureHostPermission(value: string): Promise<boolean> {
	const origin = toPermissionOrigin(value);
	if (!chrome.permissions?.contains || !chrome.permissions?.request) return false;
	if (await permissionCall('contains', origin)) return true;
	return permissionCall('request', origin);
}

function permissionCall(method: 'contains' | 'request', origin: string): Promise<boolean> {
	return new Promise(resolve => {
		try {
			chrome.permissions[method]({origins: [origin]}, granted => {
				try {
					if (chrome.runtime.lastError) return resolve(false);
				} catch { return resolve(false); }
				resolve(Boolean(granted));
			});
		} catch {
			resolve(false);
		}
	});
}
