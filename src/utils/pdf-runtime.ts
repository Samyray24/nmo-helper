export async function loadMedPdfRuntime() {
	// Legacy PDF.js installs compatibility helpers before the bundled predictor initializes.
	const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
	pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
	const medPdfNmo = await import('med-pdf-nmo/browser');
	medPdfNmo.setPdfJsLib(pdfjsLib);
	return medPdfNmo;
}
