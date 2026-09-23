const FAILURE_LIMIT = 3;
const CIRCUIT_MS = 2 * 60 * 1000;

interface ISourceHealthState {
	lastResult: string;
	attempts: number;
	successes: number;
	consecutiveFailures: number;
	totalDurationMs: number;
	openUntil: number;
}

export interface ISourceHealthSnapshot {
	readonly lastResult: string;
	readonly host: string;
	readonly attempts: number;
	readonly successRate: number;
	readonly averageDurationMs: number;
	readonly consecutiveFailures: number;
	readonly available: boolean;
	readonly score: number;
}

class SourceHealthRegistry {
	private readonly states = new Map<string, ISourceHealthState>();

	public record(url: string, status: number, durationMs: number, failed: boolean, now = Date.now(), message = ''): void {
		let host: string;
		try { host = new URL(url).hostname.toLowerCase(); } catch { return; }
		const state = this.states.get(host) ?? {lastResult: '', attempts: 0, successes: 0, consecutiveFailures: 0, totalDurationMs: 0, openUntil: 0};
		state.attempts += 1;
		state.totalDurationMs += Math.max(0, durationMs);
		const success = !failed && status >= 200 && status < 400;
		state.lastResult = success ? 'Сайт доступен' : status === 429 ? 'Ограничение запросов' : /таймаут|timeout/i.test(message) ? 'Время ожидания истекло' : status === 0 ? 'Ошибка сети' : `Ошибка HTTP ${status}`;
		if (success) {
			state.successes += 1;
			state.consecutiveFailures = 0;
			state.openUntil = 0;
		} else {
			state.consecutiveFailures += 1;
			if (state.consecutiveFailures >= FAILURE_LIMIT) state.openUntil = now + CIRCUIT_MS;
		}
		this.states.set(host, state);
	}

	public isAvailable(host: string, now = Date.now()): boolean {
		return (this.states.get(host.toLowerCase())?.openUntil ?? 0) <= now;
	}

	public score(host: string, now = Date.now()): number {
		const state = this.states.get(host.toLowerCase());
		if (!state) return 0.75;
		if (state.openUntil > now) return 0;
		const successRate = state.successes / Math.max(1, state.attempts);
		const averageDuration = state.totalDurationMs / Math.max(1, state.attempts);
		const speed = 1 / (1 + averageDuration / 5000);
		return Math.round((successRate * 0.75 + speed * 0.25) * 1000) / 1000;
	}

	public snapshot(now = Date.now()): ISourceHealthSnapshot[] {
		return [...this.states.entries()].map(([host, state]) => ({
			host,
			lastResult: state.lastResult,
			attempts: state.attempts,
			successRate: state.successes / Math.max(1, state.attempts),
			averageDurationMs: Math.round(state.totalDurationMs / Math.max(1, state.attempts)),
			consecutiveFailures: state.consecutiveFailures,
			available: state.openUntil <= now,
			score: this.score(host, now),
		})).sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
	}

	public clear(): void { this.states.clear(); }

	public recordSearchResult(url: string, count: number): void {
		try {
			const state = this.states.get(new URL(url).hostname.toLowerCase());
			if (state) state.lastResult = count ? `Найдено результатов: ${count}` : 'Поиск выполнен: результатов нет';
		} catch { /* invalid URL */ }
	}
}

export const sourceHealth = new SourceHealthRegistry();
