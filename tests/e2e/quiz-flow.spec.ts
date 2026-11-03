import path from 'node:path';
import {chromium, expect, test, type BrowserContext, type Page} from '@playwright/test';
import {questionFingerprint} from '../../src/utils/question-fingerprint';

const TOPIC = 'Кардиология - 2025';
const QUESTIONS = [
	{question: 'Какой препарат относится к антиагрегантам?', variants: ['Амоксициллин', 'Ацетилсалициловая кислота', 'Метформин'], answers: ['Ацетилсалициловая кислота']},
	{question: 'Какие признаки требуют внимания?', variants: ['Одышка', 'Нормальный сон', 'Боль в груди'], answers: ['Одышка', 'Боль в груди']},
] as const;

test('расширение выбирает одиночный и множественный ответы, переходит и завершает тест', async () => {
	test.setTimeout(55_000);
	const {context, page} = await openQuiz();
	try {
		await seedLocalAnswers(page);
		await installQuiz(page);
		await expect(page.locator('lib-questions-list .questionList-item')).toHaveCount(2, {timeout: 15_000});
		await expect(page.locator('.text_value.text-success')).toContainText('завершено');
		const submitted = await page.evaluate(() => (window as Window & {__nmoFixtureSelections: string[][]}).__nmoFixtureSelections);
		expect(submitted).toEqual(QUESTIONS.map(item => [...item.answers]));
	} finally { await context.close(); }
});

test('кнопка Стоп отменяет запланированный выбор', async () => {
	test.setTimeout(30_000);
	const {context, page} = await openQuiz();
	try {
		await seedLocalAnswers(page);
		await installQuiz(page);
		const stop = page.locator('#nmo-panel').getByRole('button', {name: 'Стоп', exact: true});
		await expect(stop).toBeEnabled({timeout: 10_000});
		await stop.click();
		await expect(stop).toBeDisabled();
		await page.waitForTimeout(6_000);
		await expect(page.locator('#questionAnchor input:checked')).toHaveCount(0);
		await expect(page.locator('.question-title-text')).toHaveText(QUESTIONS[0].question);
	} finally { await context.close(); }
});

async function openQuiz(): Promise<{context: BrowserContext; page: Page}> {
	const extension = path.resolve(__dirname, '../../dist/chrome');
	const context = await chromium.launchPersistentContext('', {
		channel: 'chromium', headless: true,
		executablePath: process.env.NMO_TEST_CHROMIUM || undefined,
		args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
	});
	const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
	const popup = await context.newPage();
	await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
	await popup.evaluate(async () => {
		await chrome.storage.local.set({
			panelCollapsed: false, mode: 'base', aiFallbackEnabled: false,
			autoSolveMode: 'full', autoSolveTests: true,
			autoSolveDelayMinSeconds: 5, autoSolveDelayMaxSeconds: 5,
			quizRecoveryEnabled: false,
		});
	});
	await context.route('https://a.edu.rosminzdrav.ru/**', route => route.fulfill({
		contentType: 'text/html; charset=utf-8',
		body: '<!doctype html><html><body><main id="fixture-root"></main></body></html>',
	}));
	const page = await context.newPage();
	await page.goto('https://a.edu.rosminzdrav.ru/nmo-extension-quiz-fixture');
	await expect(page.locator('#nmo-panel')).toBeVisible({timeout: 15_000});
	return {context, page};
}

async function seedLocalAnswers(page: Page): Promise<void> {
	const records = QUESTIONS.map(item => ({
		id: questionFingerprint(TOPIC, item.question, item.variants),
		topic: TOPIC, question: item.question, variants: [...item.variants], answers: [...item.answers],
		updatedAt: Date.now(), source: 'Сквозной тест', conflicts: [],
	}));
	await page.evaluate(async records => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('nmo-helper-local-answers', 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains('answers')) db.createObjectStore('answers', {keyPath: 'id'});
				if (!db.objectStoreNames.contains('unknown')) db.createObjectStore('unknown', {keyPath: 'id'});
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		await new Promise<void>((resolve, reject) => {
			const transaction = db.transaction('answers', 'readwrite');
			for (const record of records) transaction.objectStore('answers').put(record);
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
		db.close();
	}, records);
}

async function installQuiz(page: Page): Promise<void> {
	await page.evaluate(questions => {
		const root = document.querySelector<HTMLElement>('#fixture-root')!;
		let current = 0;
		let checked = [false, false, false];
		const submitted: string[][] = [];
		(window as Window & {__nmoFixtureSelections: string[][]}).__nmoFixtureSelections = submitted;
		const render = () => {
			const item = questions[current];
			const type = current === 0 ? 'radio' : 'checkbox';
			root.innerHTML = `<div class="mat-card-title-quiz-custom">Кардиология - 2025 - Итоговое тестирование</div>
				<div id="questionAnchor"><div class="question-title-text">${item.question}</div>
				${item.variants.map((variant, index) => `<div class="mdc-form-field"><input id="answer-${index}" type="${type}" name="answer" data-index="${index}" ${checked[index] ? 'checked' : ''}><label for="answer-${index}"><span>${variant}</span></label></div>`).join('')}
				</div><div class="question-buttons"><button class="question-buttons-primary" disabled>${current === 0 ? 'Следующий вопрос' : 'Завершить тестирование'}</button></div>`;
			const forward = root.querySelector<HTMLButtonElement>('.question-buttons-primary')!;
			forward.disabled = current === 0 ? !checked.some(Boolean) : !(checked[0] && !checked[1] && checked[2]);
		};
		root.addEventListener('change', event => {
			const input = event.target as HTMLInputElement;
			if (!input.matches('#questionAnchor input')) return;
			const index = Number(input.dataset.index);
			if (current === 0) checked = checked.map((_, idx) => idx === index);
			else checked[index] = input.checked;
			setTimeout(render, current === 0 ? 0 : 40);
		});
		root.addEventListener('click', event => {
			const button = (event.target as Element).closest<HTMLButtonElement>('.question-buttons-primary');
			if (!button || button.disabled) return;
			submitted.push(questions[current].variants.filter((_, index) => checked[index]));
			if (current === 0) {
				setTimeout(() => { current = 1; checked = [false, false, false]; render(); }, 250);
				return;
			}
			root.insertAdjacentHTML('beforeend', '<lib-quiz-finishing-confirm-dialog><div>Завершить тестирование?<button type="button">Да</button></div></lib-quiz-finishing-confirm-dialog>');
		});
		root.addEventListener('click', event => {
			if (!(event.target as Element).closest('lib-quiz-finishing-confirm-dialog button')) return;
			root.innerHTML = '<div class="text_value text-success">Тестирование завершено</div><lib-questions-list><div class="questionList"><div class="questionList-item">Первый вопрос</div><div class="questionList-item">Второй вопрос</div></div></lib-questions-list>';
		});
		render();
	}, QUESTIONS);
}
