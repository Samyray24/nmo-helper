import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderWithProviders} from '../tests-helpers';
import {answerCache} from '../utils/answer-cache';
import {usePanelUi} from './PanelUiContext';
import {useSettings} from './SettingsContext';

function SourceControls() {
	const {setMode, setCollapsed} = usePanelUi();
	const {ai} = useSettings();
	return <>
		<button onClick={() => setMode('ai')}>mode</button>
		<button onClick={() => ai.setProvider('proxy')}>provider</button>
		<button onClick={() => ai.proxy.setModel('other-model')}>model</button>
		<button onClick={() => ai.proxy.setApiKey('other-key')}>key</button>
		<button onClick={() => ai.custom.setUrl('https://other.example/v1')}>endpoint</button>
		<button onClick={() => ai.custom.setModel('other-custom-model')}>custom-model</button>
		<button onClick={() => ai.custom.setToken('other-token')}>token</button>
		<button onClick={() => setCollapsed(true)}>collapse</button>
	</>;
}

describe('Кеш при смене источника ответа', () => {
	it.each(['mode', 'provider', 'model', 'key', 'endpoint', 'custom-model', 'token'])(
		'не возвращает ответ предыдущего источника после изменения %s', action => {
			renderWithProviders(<SourceControls/>);
			answerCache.set('Источник', 'Вопрос?', ['A', 'B'], ['A']);
			fireEvent.click(screen.getByRole('button', {name: action}));

			expect(answerCache.get('Источник', 'Вопрос?', ['A', 'B'])).toBeNull();
		},
	);

	it('сохраняет ответ при сворачивании панели', () => {
		renderWithProviders(<SourceControls/>);
		answerCache.set('Источник', 'Вопрос?', ['A', 'B'], ['A']);
		fireEvent.click(screen.getByRole('button', {name: 'collapse'}));

		expect(answerCache.get('Источник', 'Вопрос?', ['A', 'B'])!.answers).toEqual(['A']);
	});
});
