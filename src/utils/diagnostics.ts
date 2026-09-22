import {getQuestionText, getTopicElement, getVariantElements} from '../api/dom';
import {getBrowserCapabilities} from './browser-capabilities';
import {questionFingerprint} from './question-fingerprint';

const MAX_EVENTS = 200;

export interface IDiagnosticEvent {
	readonly at: string;
	readonly kind: 'network' | 'automation' | 'storage' | 'ui';
	readonly code: string;
	readonly host?: string;
	readonly status?: number;
	readonly durationMs?: number;
}

export interface IDiagnosticsReport {
	readonly generatedAt: string;
	readonly browser: ReturnType<typeof getBrowserCapabilities>;
	readonly dom: {topic: boolean; question: boolean; variants: number; nextButton: boolean};
	readonly storage: {extensionStorage: boolean; indexedDb: boolean};
	readonly question: {fingerprint: string; text?: string; variants?: string[]};
	readonly events: readonly IDiagnosticEvent[];
}

class Diagnostics {
	private readonly events: IDiagnosticEvent[] = [];

	public record(event: Omit<IDiagnosticEvent, 'at'>): void {
		this.events.push({...event, at: new Date().toISOString(), code: sanitizeCode(event.code)});
		if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
	}

	public recordNetwork(url: string, status: number, durationMs: number, failed: boolean): void {
		let host = 'invalid-url';
		try { host = new URL(url).hostname; } catch { /* safe fallback */ }
		this.record({kind: 'network', code: failed ? 'request-failed' : 'request-complete', host, status, durationMs: Math.max(0, Math.round(durationMs))});
	}

	public snapshot(options: {includeQuestionText: boolean}): IDiagnosticsReport {
		const topic = getTopicElement()?.textContent?.trim() ?? '';
		const question = getQuestionText() ?? '';
		const variants = getVariantElements().map(element => element.textContent?.trim() ?? '');
		return {
			generatedAt: new Date().toISOString(),
			browser: getBrowserCapabilities(),
			dom: {topic: !!topic, question: !!question, variants: variants.length, nextButton: !!document.querySelector('button.question-buttons-primary, .question-buttons button')},
			storage: {extensionStorage: !!chrome.storage?.local, indexedDb: typeof indexedDB !== 'undefined'},
			question: {
				fingerprint: question ? questionFingerprint(topic, question, variants) : '',
				...(options.includeQuestionText ? {text: question, variants} : {}),
			},
			events: this.events.map(event => ({...event})),
		};
	}

	public clear(): void { this.events.length = 0; }
}

export const diagnostics = new Diagnostics();

function sanitizeCode(value: string): string {
	return value.replace(/bearer\s+\S+|(?:token|key|api[_-]?key)\s*[:=]\s*\S+/gi, '[redacted]').slice(0, 120);
}
