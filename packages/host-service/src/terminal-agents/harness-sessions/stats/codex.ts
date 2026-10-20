import { num } from "../../../trpc/router/usage/history/parse";
import {
	costUsd,
	matchModelRate,
} from "../../../trpc/router/usage/history/pricing";
import { codexContextWindow } from "../context-window";
import { addToTotals, emptyTotals, recordEventTime } from "./totals";
import type {
	CodexStatsState,
	SessionStats,
	SessionStatsLineReader,
} from "./types";

interface CodexUsage {
	input_tokens?: number;
	cached_input_tokens?: number;
	cache_write_input_tokens?: number;
	output_tokens?: number;
	total_tokens?: number;
}

interface CodexLine {
	type?: string;
	timestamp?: string;
	payload?: {
		type?: string;
		model?: string;
		info?: {
			last_token_usage?: CodexUsage;
			total_token_usage?: CodexUsage;
			model_context_window?: number;
		} | null;
	};
}

export function emptyCodexStats(): CodexStatsState {
	return {
		agent: "codex",
		model: null,
		turns: 0,
		startedAt: null,
		lastEventAt: null,
		totals: emptyTotals(),
		lastDeltaSignature: null,
		reportedTotals: null,
		contextUsed: 0,
		reportedContextWindow: null,
	};
}

function addDelta(state: CodexStatsState, usage: CodexUsage): void {
	const signature = JSON.stringify(usage);
	if (signature === state.lastDeltaSignature) return;
	state.lastDeltaSignature = signature;
	const input = num(usage.input_tokens);
	const cachedInput = num(usage.cached_input_tokens);
	const output = num(usage.output_tokens);
	const counts = {
		uncachedInput: Math.max(0, input - cachedInput),
		cachedInput,
		cacheWrite5m: num(usage.cache_write_input_tokens),
		cacheWrite1h: 0,
		output,
	};
	const rate = matchModelRate("codex", state.model ?? "unknown", input);
	addToTotals(state.totals, { ...counts, costUsd: costUsd(rate, counts) });
	state.contextUsed = num(usage.total_tokens) || input + output;
}

export function codexStatsReader(
	state: CodexStatsState,
): SessionStatsLineReader<CodexStatsState> {
	return {
		onLine(line) {
			if (
				!line.includes('"token_count"') &&
				!line.includes('"user_message"') &&
				!line.includes('"turn_context"') &&
				!line.includes('"session_meta"')
			) {
				return;
			}
			let parsed: CodexLine;
			try {
				parsed = JSON.parse(line);
			} catch {
				return;
			}
			recordEventTime(state, parsed.timestamp);
			const payload = parsed.payload;
			if (parsed.type === "turn_context" || parsed.type === "session_meta") {
				if (typeof payload?.model === "string") state.model = payload.model;
				return;
			}
			if (payload?.type === "user_message") {
				state.turns += 1;
				return;
			}
			if (payload?.type !== "token_count" || !payload.info) return;
			const { info } = payload;
			const window = num(info.model_context_window);
			if (window > 0) state.reportedContextWindow = window;
			if (info.total_token_usage) {
				state.reportedTotals = {
					input: num(info.total_token_usage.input_tokens),
					cachedInput: num(info.total_token_usage.cached_input_tokens),
					output: num(info.total_token_usage.output_tokens),
				};
			}
			if (info.last_token_usage) addDelta(state, info.last_token_usage);
		},
		finish() {
			return state;
		},
	};
}

export function codexSessionStats(state: CodexStatsState): SessionStats | null {
	const { totals, reportedTotals } = state;
	if (totals.requests === 0 && !reportedTotals) return null;
	return {
		agent: "codex",
		model: state.model,
		turns: state.turns,
		contextUsed: state.contextUsed,
		contextMax: codexContextWindow(state.model, state.reportedContextWindow),
		inputTokens: reportedTotals
			? Math.max(0, reportedTotals.input - reportedTotals.cachedInput)
			: totals.uncachedInput + totals.cacheWrite5m,
		cachedInputTokens: reportedTotals
			? reportedTotals.cachedInput
			: totals.cachedInput,
		outputTokens: reportedTotals ? reportedTotals.output : totals.output,
		costUsd: totals.requests > 0 ? totals.costUsd : null,
		startedAt: state.startedAt,
		lastEventAt: state.lastEventAt,
	};
}
