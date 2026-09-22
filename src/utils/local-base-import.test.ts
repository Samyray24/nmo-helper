import {describe, expect, it} from 'vitest';
import {parseCsvBase, parseJsonBase, serializeLocalBase} from './local-base-import';

describe('local base import', () => {
	it('читает версионированный JSON', () => {
		const records = parseJsonBase(JSON.stringify({schemaVersion: 1, records: [{topic: 'T', question: 'Q', variants: ['A', 'B'], answers: ['A']}]}));
		expect(records).toHaveLength(1);
		expect(records[0].answers).toEqual(['A']);
	});

	it('читает CSV с разделёнными вертикальной чертой списками', () => {
		expect(parseCsvBase('topic,question,variants,answers\nT,Q,A|B,A')).toEqual([{topic: 'T', question: 'Q', variants: ['A', 'B'], answers: ['A']}]);
	});

	it('отклоняет неизвестную схему и ответ вне вариантов', () => {
		expect(() => parseJsonBase('{"schemaVersion":9,"records":[]}')).toThrow('версия схемы');
		expect(() => parseCsvBase('topic,question,variants,answers\nT,Q,A|B,C')).toThrow('ответ отсутствует');
	});

	it('экспортируется обратно в схему 1', () => {
		const text = serializeLocalBase([{topic: 'T', question: 'Q', variants: ['A', 'B'], answers: ['A']}]);
		expect(JSON.parse(text)).toMatchObject({schemaVersion: 1, records: [{question: 'Q'}]});
	});
});
