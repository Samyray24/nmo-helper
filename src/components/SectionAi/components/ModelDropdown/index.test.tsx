import {act, fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {applyPanelTheme} from '../../../../utils/theme';
import ModelDropdown from './index';

describe('ModelDropdown', () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="nmo-panel" data-theme="dark"></div>';
		applyPanelTheme('dark');
	});

	it('открывает портал без артефакта «)», наследует светлую тему и фильтрует модели', () => {
		applyPanelTheme('light');
		const setModel = vi.fn();
		render(<ModelDropdown model="gpt-5.4-mini" setModel={setModel}/>);

		fireEvent.click(screen.getByRole('button', {name: /gpt-5\.4-mini/i}));

		const portal = document.querySelector('[data-nmo-portal]') as HTMLElement | null;
		expect(portal).not.toBeNull();
		expect(portal?.getAttribute('data-nmo-theme')).toBe('light');

		const optionsContainer = screen.getByRole('listbox', {name: 'Модели ProxyAPI'});
		const directTextNodes = [...optionsContainer.childNodes]
			.filter(node => node.nodeType === Node.TEXT_NODE)
			.map(node => node.textContent?.trim())
			.filter(Boolean);
		expect(directTextNodes).toEqual([]);

		fireEvent.change(screen.getByRole('searchbox', {name: 'Поиск модели'}), {
			target: {value: 'claude-opus-4.8'},
		});
		expect(screen.getAllByRole('option')).toHaveLength(1);

		fireEvent.click(screen.getByRole('option', {name: /claude-opus-4\.8/i}));
		expect(setModel).toHaveBeenCalledWith('claude-opus-4-8');
		expect(document.querySelector('[data-nmo-portal]')).toBeNull();
	});

	it('закрывается по Escape и обновляет data-nmo-theme при переключении темы на лету', () => {
		const setModel = vi.fn();
		render(<ModelDropdown model="gpt-5.4-mini" setModel={setModel}/>);

		fireEvent.click(screen.getByRole('button', {name: /gpt-5\.4-mini/i}));
		expect(document.querySelector('[data-nmo-portal]')?.getAttribute('data-nmo-theme')).toBe('dark');

		act(() => {
			applyPanelTheme('light');
		});
		expect(document.querySelector('[data-nmo-portal]')?.getAttribute('data-nmo-theme')).toBe('light');

		fireEvent.keyDown(document, {key: 'Escape'});
		expect(document.querySelector('[data-nmo-portal]')).toBeNull();
	});
});
