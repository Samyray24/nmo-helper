const FINISH_RELOAD_STORAGE_KEY = 'nmoHelperFinishReloadAt';
const FINISH_RELOAD_GUARD_MS = 60_000;

const STALE_OVERLAY_SELECTORS = [
	'.cdk-overlay-backdrop',
	'lib-quiz-finishing-confirm-dialog',
	'.mat-mdc-dialog-container',
	'.mat-dialog-container',
] as const;

/** Удаляет оставшиеся после завершения теста слои, блокирующие клики по НМО. */
export function clearStaleQuizFinishBlockers(): number {
	let changed = 0;
	const elements = new Set<HTMLElement>();

	for (const selector of STALE_OVERLAY_SELECTORS) {
		document.querySelectorAll<HTMLElement>(selector).forEach(element => {
			const pane = element.closest<HTMLElement>('.cdk-overlay-pane');
			elements.add(pane ?? element);
		});
	}

	for (const element of elements) {
		if (!element.isConnected) continue;
		element.remove();
		changed += 1;
	}

	const roots = [document.documentElement, document.body, document.querySelector<HTMLElement>('app-root')]
		.filter((element): element is HTMLElement => !!element);
	for (const root of roots) {
		if (root.hasAttribute('inert')) {
			root.removeAttribute('inert');
			changed += 1;
		}
		if (root.style.pointerEvents === 'none') {
			root.style.removeProperty('pointer-events');
			changed += 1;
		}
	}

	if (document.documentElement.classList.contains('cdk-global-scrollblock')) {
		document.documentElement.classList.remove('cdk-global-scrollblock');
		changed += 1;
	}

	return changed;
}

/** Разрешает только одно автоматическое обновление страницы в минуту. */
export function claimQuizFinishReload(now = Date.now()): boolean {
	try {
		const previous = Number(window.sessionStorage.getItem(FINISH_RELOAD_STORAGE_KEY));
		if (Number.isFinite(previous) && previous > 0 && now - previous < FINISH_RELOAD_GUARD_MS) return false;
		window.sessionStorage.setItem(FINISH_RELOAD_STORAGE_KEY, String(now));
		return true;
	} catch {
		return false;
	}
}
