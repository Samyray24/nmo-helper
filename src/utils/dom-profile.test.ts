import {beforeEach, describe, expect, it} from 'vitest';
import {detectDomProfile} from './dom-profile';

beforeEach(() => { document.body.innerHTML = ''; });

describe('detectDomProfile', () => {
	it('распознаёт текущую Material-разметку', () => {
		document.body.innerHTML = '<div class="mat-card-title-quiz-custom"></div><div id="questionAnchor"><div class="question-title-text"></div><div class="mdc-form-field"><span>A</span></div></div>';
		expect(detectDomProfile()).toMatchObject({name: 'current-material', missing: []});
	});

	it('распознаёт резервную семантическую разметку', () => {
		document.body.innerHTML = '<div class="mat-mdc-card-title"></div><div data-testid="question-anchor"><div data-testid="question-text"></div><div data-testid="answer-option">A</div></div>';
		expect(detectDomProfile()).toMatchObject({name: 'compatible', missing: []});
	});

	it('перечисляет отсутствующие критичные части', () => {
		expect(detectDomProfile()).toMatchObject({name: 'unknown', missing: ['topic', 'questionAnchor', 'questionText', 'variant']});
	});
});
