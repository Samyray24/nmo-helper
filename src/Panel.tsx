import {createRoot} from 'react-dom/client';
import type {IExtensionState} from './types';
import {storageSet} from './utils';
import App from './App';

export function createPanel(state: IExtensionState): HTMLElement {
	const panel = document.createElement('div');
	panel.id = 'nmo-panel';
	if (state.savedCollapsed) panel.classList.add('collapsed');
	document.body.appendChild(panel);

	if (state.savedRight !== null && state.savedTop !== null) {
		panel.style.right = state.savedRight + 'px';
		panel.style.top = state.savedTop + 'px';
		panel.style.left = 'auto';
	}

	const root = createRoot(panel);
	root.render(<App initialState={state}/>);
	return panel;
}

const DRAG_HANDLES = '.nmo-titlebar, .nmo-pill, .nmo-footer';
const INTERACTIVE = 'button, a, input, textarea, select, label';

export function initPanelBehavior(panel: HTMLElement): void {
	let isDragging = false;
	let dx = 0, dy = 0;
	let panelWidth = 0, panelHeight = 0;
	const keepInViewport = (): void => {
		if (isDragging) return;
		const rect = panel.getBoundingClientRect();
		const viewportWidth = document.documentElement.clientWidth;
		const position = constrainPanelPosition(rect.left, rect.top, rect.width, rect.height,
			viewportWidth, document.documentElement.clientHeight);
		applyPanelPosition(panel, position.left, position.top, rect.width, viewportWidth);
	};
	// Сохранённая позиция могла относиться к другому экрану или масштабу.
	keepInViewport();
	window.addEventListener('resize', keepInViewport);
	const resizeObserver = new ResizeObserver(keepInViewport);
	resizeObserver.observe(panel);

	panel.addEventListener('mousedown', (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.closest(INTERACTIVE)) return;
		if (!target.closest(DRAG_HANDLES)) return;

		e.preventDefault();
		const rect = panel.getBoundingClientRect();
		// смещение курсора относительно левого-верхнего угла панели — фиксируем в mousedown
		dx = e.clientX - rect.left;
		dy = e.clientY - rect.top;
		panelWidth = rect.width;
		panelHeight = rect.height;
		isDragging = true;
		panel.style.willChange = 'right, top';
	});

	document.addEventListener('mousemove', (e: MouseEvent) => {
		if (!isDragging) return;
		e.preventDefault();
		requestAnimationFrame(() => {
			if (!isDragging) return;
			const viewportWidth = document.documentElement.clientWidth;
			const viewportHeight = document.documentElement.clientHeight;
			const position = constrainPanelPosition(
				e.clientX - dx,
				e.clientY - dy,
				panelWidth,
				panelHeight,
				viewportWidth,
				viewportHeight,
			);
			applyPanelPosition(panel, position.left, position.top, panelWidth, viewportWidth);
		});
	});

	document.addEventListener('mouseup', () => {
		if (!isDragging) return;
		isDragging = false;
		panel.style.willChange = '';
		keepInViewport();
		const rect = panel.getBoundingClientRect();
		const right = document.documentElement.clientWidth - rect.right;
		storageSet('panelRight', right);
		storageSet('panelTop', rect.top);
	});
}

interface IPanelPosition {
	readonly left: number;
	readonly top: number;
}

export function constrainPanelPosition(left: number, top: number, panelWidth: number, panelHeight: number, viewportWidth: number, viewportHeight: number): IPanelPosition {
	const maxLeft = Math.max(0, viewportWidth - panelWidth);
	const maxTop = Math.max(0, viewportHeight - panelHeight);

	return {
		left: Math.min(Math.max(left, 0), maxLeft),
		// Заголовок расположен сверху: не даём ему уйти за верхнюю границу.
		top: Math.min(Math.max(top, 0), maxTop),
	};
}

function applyPanelPosition(panel: HTMLElement, left: number, top: number, panelWidth: number, viewportWidth: number): void {
	panel.style.right = viewportWidth - (left + panelWidth) + 'px';
	panel.style.left = 'auto';
	panel.style.top = top + 'px';
}
