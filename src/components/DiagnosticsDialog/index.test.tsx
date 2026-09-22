import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import DiagnosticsDialog from './index';

const mocks = vi.hoisted(() => ({setOpen: vi.fn(), snapshot: vi.fn()}));
vi.mock('../../contexts/DiagnosticsContext', () => ({
	useDiagnosticsDialog: () => ({open: true, setOpen: mocks.setOpen}),
}));
vi.mock('../../utils/diagnostics', () => ({diagnostics: {snapshot: mocks.snapshot}}));

describe('DiagnosticsDialog', () => {
	it('показывает краткую проверку и не включает текст вопроса по умолчанию', () => {
		mocks.snapshot.mockReturnValue({
			browser: {extensionVersion: '5.3.0', family: 'firefox', browserVersion: '128'},
			dom: {topic: true, question: true, variants: 4, nextButton: true},
			storage: {indexedDb: true}, events: [],
		});
		render(<DiagnosticsDialog/>);
		expect(screen.getByRole('dialog', {name: 'Диагностика расширения'})).toBeInTheDocument();
		expect(screen.getByText('Версия 5.3.0')).toBeInTheDocument();
		expect(screen.getByRole('checkbox')).not.toBeChecked();
		expect(mocks.snapshot).toHaveBeenCalledWith({includeQuestionText: false});
		fireEvent.click(screen.getByRole('button', {name: 'Закрыть'}));
		expect(mocks.setOpen).toHaveBeenCalledWith(false);
	});
});
