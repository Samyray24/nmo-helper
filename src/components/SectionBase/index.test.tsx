import {render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import SectionBase from './index';

const mocks = vi.hoisted(() => ({stats: vi.fn(), listUnknown: vi.fn()}));
vi.mock('../../utils/local-answer-db', () => ({localAnswerDb: {
	stats: mocks.stats, listUnknown: mocks.listUnknown,
	listAnswers: vi.fn().mockResolvedValue([]), merge: vi.fn(), replace: vi.fn(), clear: vi.fn(),
}}));

describe('SectionBase', () => {
	beforeEach(() => {
		mocks.stats.mockResolvedValue({answers: 14, unknown: 1, backend: 'indexeddb'});
		mocks.listUnknown.mockResolvedValue([{id: 'q1', question: 'Неизвестный вопрос'}]);
	});

	it('показывает статистику, а управление держит свёрнутым', async () => {
		render(<SectionBase/>);
		await waitFor(() => expect(screen.getByText('14')).toBeInTheDocument());
		expect(screen.getByText('1')).toBeInTheDocument();
		expect(screen.getByText('Хранилище: IndexedDB')).toBeInTheDocument();
		expect(screen.getByText('Управление данными').closest('details')).not.toHaveAttribute('open');
		expect(screen.getByText('Последние неизвестные вопросы').closest('details')).not.toHaveAttribute('open');
	});
});

vi.mock('../../contexts/SettingsContext', () => ({useSettings: () => ({autoSolve: {setEnabled: vi.fn()}})}));
