import {beforeEach, describe, expect, it} from 'vitest';
import {diagnostics} from './diagnostics';

beforeEach(() => { diagnostics.clear(); document.body.innerHTML = ''; });

describe('diagnostics', () => {
	it('ограничивает журнал 200 событиями и удаляет секреты', () => {
		for (let index = 0; index < 205; index += 1) diagnostics.record({kind: 'ui', code: `token=secret-${index}`});
		const report = diagnostics.snapshot({includeQuestionText: false});
		expect(report.events).toHaveLength(200);
		expect(JSON.stringify(report)).not.toContain('secret-204');
	});

	it('не включает текст вопроса без явного флажка', () => {
		document.body.innerHTML = '<div class="mat-card-title-quiz-custom">Тема</div><div id="questionAnchor"><div class="question-title-text">Секретный вопрос</div><div class="mdc-form-field"><span>A</span></div></div>';
		expect(diagnostics.snapshot({includeQuestionText: false}).question).not.toHaveProperty('text');
		expect(diagnostics.snapshot({includeQuestionText: true}).question.text).toBe('Секретный вопрос');
	});
});
