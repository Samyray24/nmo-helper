export interface IBrowserCapabilities {
	readonly family: 'firefox' | 'yandex' | 'edge' | 'chrome' | 'chromium' | 'unknown';
	readonly browserVersion: string;
	readonly manifestVersion: number;
	readonly extensionVersion: string;
	readonly legacyFirefox: boolean;
	readonly optionalPermissions: boolean;
}

export function getBrowserCapabilities(userAgent = navigator.userAgent): IBrowserCapabilities {
	const manifest = safeManifest();
	const detected = detectBrowser(userAgent);
	return {
		...detected,
		manifestVersion: Number(manifest.manifest_version ?? 0),
		extensionVersion: String(manifest.version ?? 'dev'),
		legacyFirefox: detected.family === 'firefox' && Number(detected.browserVersion.split('.')[0]) < 140,
		optionalPermissions: typeof chrome.permissions?.request === 'function',
	};
}

export function detectBrowser(userAgent: string): Pick<IBrowserCapabilities, 'family' | 'browserVersion'> {
	const patterns: Array<[IBrowserCapabilities['family'], RegExp]> = [
		['yandex', /YaBrowser\/([\d.]+)/i],
		['edge', /Edg\/([\d.]+)/i],
		['firefox', /Firefox\/([\d.]+)/i],
		['chrome', /Chrome\/([\d.]+)/i],
		['chromium', /Chromium\/([\d.]+)/i],
	];
	for (const [family, pattern] of patterns) {
		const match = userAgent.match(pattern);
		if (match) return {family, browserVersion: match[1]};
	}
	return {family: 'unknown', browserVersion: ''};
}

function safeManifest(): Partial<chrome.runtime.Manifest> {
	try { return chrome.runtime.getManifest?.() ?? {}; } catch { return {}; }
}
