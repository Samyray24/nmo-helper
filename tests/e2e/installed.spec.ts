import path from 'node:path';
import {chromium, expect, test} from '@playwright/test';

test('установленное расширение: storage, фон, остановка, темы и масштаб', async () => {
	test.setTimeout(60_000);
	const extension = path.resolve(__dirname, '../../dist/chrome');
	const context = await chromium.launchPersistentContext('', {
		channel: 'chromium', headless: true,
		executablePath: process.env.NMO_TEST_CHROMIUM || undefined,
		args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
	});
	try {
		const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
		const startup = await context.newPage();
		await startup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
		await startup.evaluate(async () => {
			await chrome.storage.local.set({panelCollapsed: false, mode: 'base', aiFallbackEnabled: false, autoSolveMode: 'highlight', autoSolveTests: false});
		});
		await context.route('https://a.edu.rosminzdrav.ru/**', route => route.fulfill({contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><body><main>Учебная тестовая страница</main></body></html>'}));
		const page = await context.newPage();
		await page.goto('https://a.edu.rosminzdrav.ru/nmo-extension-fixture');
		const panel = page.locator('#nmo-panel');
		await expect(panel.getByText('NMO Helper')).toBeVisible({timeout: 15_000});
		await expect(panel.getByRole('button', {name: 'Стоп', exact: true})).toBeDisabled();
		await expect(panel.getByText('Поиск и редактор ответов')).toBeVisible();
		await page.screenshot({path: 'output/playwright/installed-dark.png'});
		await panel.getByRole('button', {name: 'Светлая тема', exact: true}).click();
		await expect(panel).toHaveAttribute('data-theme', 'light');
		await page.reload();
		await expect(panel).toHaveAttribute('data-theme', 'light');
		for (const zoom of [1.25, 2]) {
			await startup.evaluate(async value => {
				const tabs = await chrome.tabs.query({});
				for (const tab of tabs) if (tab.id) await chrome.tabs.setZoom(tab.id, value);
			}, zoom);
			await expect(panel.getByRole('button', {name: 'Тёмная тема', exact: true})).toBeVisible();
			expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
			await page.screenshot({path: `output/playwright/installed-light-${zoom}.png`});
		}
		// A real extension page sends a real message to the background worker.
		const popup = await context.newPage();
		await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
		const stored = await popup.evaluate(async () => {
			await chrome.runtime.sendMessage({action: 'credential-set', key: 'apiKey', value: 'fixture-not-a-real-key'});
			const response = await chrome.runtime.sendMessage({action: 'credential-get', key: 'apiKey'});
			const local = await chrome.storage.local.get('apiKey');
			await chrome.runtime.sendMessage({action: 'credential-set', key: 'apiKey', value: ''});
			return {value: response.value, persisted: Boolean(local.apiKey)};
		});
		expect(stored).toEqual({value: 'fixture-not-a-real-key', persisted: false});
	} finally { await context.close(); }
});
