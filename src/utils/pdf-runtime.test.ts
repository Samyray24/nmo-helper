import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
	events: [] as string[],
	worker: {workerSrc: ''},
	setPdfJsLib: vi.fn(),
	answerQuestion: vi.fn(),
}));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => {
	mocks.events.push('legacy');
	return {GlobalWorkerOptions: mocks.worker, getDocument: vi.fn()};
});
vi.mock('med-pdf-nmo/browser', () => {
	mocks.events.push('med-pdf');
	return {setPdfJsLib: mocks.setPdfJsLib, answerQuestion: mocks.answerQuestion};
});
import {loadMedPdfRuntime} from './pdf-runtime';

describe('PDF runtime for older browsers', () => {
	beforeEach(() => {
		vi.resetModules();
		mocks.events.length = 0;
		mocks.worker.workerSrc = '';
		mocks.setPdfJsLib.mockClear();
		vi.stubGlobal('chrome', {runtime: {getURL: (name: string) => `moz-extension://test/${name}`}});
	});
	it('initializes compatibility code before the predictor and supplies that runtime', async () => {
		const runtime = await loadMedPdfRuntime();
		expect(mocks.events).toEqual(['legacy', 'med-pdf']);
		expect(mocks.setPdfJsLib).toHaveBeenCalledWith(expect.objectContaining({GlobalWorkerOptions: mocks.worker}));
		expect(runtime.answerQuestion).toBe(mocks.answerQuestion);
	});
	it('uses the worker packaged inside the extension', async () => {
		await loadMedPdfRuntime();
		expect(mocks.worker.workerSrc).toBe('moz-extension://test/pdf.worker.min.mjs');
	});
});
