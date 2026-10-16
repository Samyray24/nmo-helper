import {describe, expect, it} from 'vitest';
import {constrainPanelPosition} from './Panel';

describe('panel position', () => {
	it('не позволяет заголовку уйти за верхнюю границу viewport', () => {
		expect(constrainPanelPosition(700, -492, 360, 500, 1280, 720)).toEqual({
			left: 700,
			top: 0,
		});
	});

	it('удерживает всю панель внутри viewport', () => {
		expect(constrainPanelPosition(-500, 900, 360, 500, 1280, 720)).toEqual({
			left: 0,
			top: 220,
		});
	});
});
