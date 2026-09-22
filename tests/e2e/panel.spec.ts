import path from 'node:path';
import {expect, test} from '@playwright/test';

const root = path.resolve(__dirname, '../..');

for (const viewport of [{width: 1366, height: 768}, {width: 1024, height: 768}]) {
	test(`панель помещается в ${viewport.width}x${viewport.height}`, async ({page}) => {
		await page.setViewportSize(viewport);
		await page.setContent(quizMarkup());
		await installChromeShim(page);
		await page.addStyleTag({path: path.join(root, 'dist/chrome/content.css')});
		await page.addScriptTag({path: path.join(root, 'dist/chrome/content.js')});

		const panel = page.locator('#nmo-panel');
		await expect(panel.getByText('NMO Helper')).toBeVisible();
		await expect(panel.getByRole('button', {name: 'База'})).toBeVisible();
		await panel.getByRole('button', {name: 'База'}).click();
		await expect(panel.getByText('Локальная база работает без сети')).toBeVisible();

		await panel.getByRole('button', {name: 'Настройки'}).click();
		const mode = panel.getByLabel('Режим автоматизации');
		await expect(mode).toBeVisible();
		await expect(mode.locator('option')).toHaveCount(3);
		await expect(panel.locator('.nmo-settings-menu details')).not.toHaveAttribute('open', '');

		expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
	});
}

async function installChromeShim(page: import('@playwright/test').Page): Promise<void> {
	await page.evaluate(() => {
		const local: Record<string, unknown> = {
			panelCollapsed: false,
			aiFallbackEnabled: false,
		};
		const session: Record<string, unknown> = {};
		const area = (store: Record<string, unknown>) => ({
			get: (key: string | string[], callback: (value: Record<string, unknown>) => void) => {
				const keys = Array.isArray(key) ? key : [key];
				callback(Object.fromEntries(keys.filter(item => item in store).map(item => [item, store[item]])));
			},
			set: (value: Record<string, unknown>, callback?: () => void) => { Object.assign(store, value); callback?.(); },
			remove: (key: string | string[], callback?: () => void) => { (Array.isArray(key) ? key : [key]).forEach(item => delete store[item]); callback?.(); },
		});
		Object.defineProperty(window, 'chrome', {value: {
			storage: {local: area(local), session: area(session)},
			runtime: {
				getURL: (value: string) => `chrome-extension://fixture/${value}`,
				sendMessage: (_message: unknown, callback: (response: unknown) => void) => callback({error: false, status: 200, text: '<html></html>'}),
			},
			permissions: {contains: (_value: unknown, callback: (granted: boolean) => void) => callback(true), request: (_value: unknown, callback: (granted: boolean) => void) => callback(true)},
		}, configurable: true});
	});
}

function quizMarkup(): string {
	return `<!doctype html><html><body>
		<main><div class="mat-card-title-quiz-custom">Кардиология — тренировочный тест</div>
		<div id="questionAnchor"><div class="question-title-text">Какой препарат относится к антиагрегантам?</div>
		${['Ацетилсалициловая кислота', 'Амоксициллин', 'Метформин'].map((answer, index) => `<div class="mdc-form-field"><input id="a${index}" type="radio" name="answer"><label for="a${index}"><span>${answer}</span></label></div>`).join('')}
		</div><div class="question-buttons"><button class="question-buttons-primary">Следующий вопрос</button></div></main>
	</body></html>`;
}
