import type { TokenTotals } from "./types";

export function emptyTotals(): TokenTotals {
	return {
		uncachedInput: 0,
		cachedInput: 0,
		cacheWrite5m: 0,
		cacheWrite1h: 0,
		output: 0,
		costUsd: 0,
		requests: 0,
	};
}

export function addToTotals(
	totals: TokenTotals,
	counts: Omit<TokenTotals, "requests">,
): void {
	totals.uncachedInput += counts.uncachedInput;
	totals.cachedInput += counts.cachedInput;
	totals.cacheWrite5m += counts.cacheWrite5m;
	totals.cacheWrite1h += counts.cacheWrite1h;
	totals.output += counts.output;
	totals.costUsd += counts.costUsd;
	totals.requests += 1;
}

export function recordEventTime(
	state: { startedAt: number | null; lastEventAt: number | null },
	raw: unknown,
): void {
	if (typeof raw !== "string") return;
	const at = Date.parse(raw);
	if (!Number.isFinite(at)) return;
	state.startedAt =
		state.startedAt === null ? at : Math.min(state.startedAt, at);
	state.lastEventAt =
		state.lastEventAt === null ? at : Math.max(state.lastEventAt, at);
}
