import {beforeEach, describe, expect, it} from 'vitest';
import {claimQuizFinishReload, clearStaleQuizFinishBlockers} from './quiz-finish-recovery';

beforeEach(() => {
	document.documentElement.className = '';
	document.documentElement.removeAttribute('style');
	document.body.innerHTML = '';
	document.body.removeAttribute('style');
	window.sessionStorage.clear();
});

describe('восстановление страницы после завершения теста', () => {
	it('убирает зависший диалог, backdrop и запреты взаимодействия', () => {
		document.documentElement.classList.add('cdk-global-scrollblock');
		document.body.style.pointerEvents = 'none';
		document.body.innerHTML = `
			<app-root inert></app-root>
			<div class="cdk-overlay-backdrop"></div>
			<div class="cdk-overlay-pane"><div class="mat-mdc-dialog-container"></div></div>
		`;

		expect(clearStaleQuizFinishBlockers()).toBeGreaterThan(0);
		expect(document.querySelector('.cdk-overlay-backdrop')).toBeNull();
		expect(document.querySelector('.cdk-overlay-pane')).toBeNull();
		expect(document.querySelector('app-root')).not.toHaveAttribute('inert');
		expect(document.body.style.pointerEvents).toBe('');
		expect(document.documentElement).not.toHaveClass('cdk-global-scrollblock');
	});

	it('не разрешает цикл автоматических обновлений', () => {
		expect(claimQuizFinishReload(1_000_000)).toBe(true);
		expect(claimQuizFinishReload(1_030_000)).toBe(false);
		expect(claimQuizFinishReload(1_061_000)).toBe(true);
	});
});
