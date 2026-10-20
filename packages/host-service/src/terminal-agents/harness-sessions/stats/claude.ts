import { num } from "../../../trpc/router/usage/history/parse";
import {
	costUsd,
	matchModelRate,
} from "../../../trpc/router/usage/history/pricing";
import { claudeContextWindow } from "../context-window";
import { addToTotals, emptyTotals, recordEventTime } from "./totals";
import type {
	ClaudeRequest,
	ClaudeStatsState,
	SessionStats,
	SessionStatsLineReader,
} from "./types";

interface ClaudeLine {
	type?: string;
	requestId?: string;
	isSidechain?: boolean;
	isMeta?: boolean;
	timestamp?: string;
	message?: {
		id?: string;
		model?: string;
		content?: unknown;
		usage?: {
			input_tokens?: number;
			output_tokens?: number;
			cache_read_input_tokens?: number;
			cache_creation_input_tokens?: number;
			cache_creation?: {
				ephemeral_5m_input_tokens?: number;
				ephemeral_1h_input_tokens?: number;
			};
		};
	};
}

export function emptyClaudeStats(): ClaudeStatsState {
	return {
		agent: "claude",
		model: null,
		turns: 0,
		startedAt: null,
		lastEventAt: null,
		totals: emptyTotals(),
		countedRequestKeys: [],
		pendingKey: null,
		pending: null,
		lastRequestInput: 0,
	};
}

function isPrompt(content: unknown): boolean {
	if (typeof content === "string") return content.trim().length > 0;
	if (!Array.isArray(content)) return false;
	return content.some(
		(block: { type?: unknown; text?: unknown } | null) =>
			block?.type === "text" &&
			typeof block.text === "string" &&
			block.text.trim().length > 0,
	);
}

function toRequest(line: ClaudeLine): ClaudeRequest | null {
	const usage = line.message?.usage;
	const model = line.message?.model;
	if (!usage || !model || model === "<synthetic>") return null;
	const write5m = num(usage.cache_creation?.ephemeral_5m_input_tokens);
	const write1h = num(usage.cache_creation?.ephemeral_1h_input_tokens);
	return {
		model,
		uncachedInput: num(usage.input_tokens),
		cachedInput: num(usage.cache_read_input_tokens),
		cacheWrite5m:
			write5m + write1h > 0 ? write5m : num(usage.cache_creation_input_tokens),
		cacheWrite1h: write1h,
		output: num(usage.output_tokens),
	};
}

function requestInput(request: ClaudeRequest): number {
	return (
		request.uncachedInput +
		request.cachedInput +
		request.cacheWrite5m +
		request.cacheWrite1h
	);
}

function requestCost(request: ClaudeRequest): number {
	const rate = matchModelRate(
		"claude",
		request.model,
		request.uncachedInput + request.cachedInput,
	);
	return costUsd(rate, request);
}

function addRequest(state: ClaudeStatsState, request: ClaudeRequest): void {
	addToTotals(state.totals, { ...request, costUsd: requestCost(request) });
}

export function claudeStatsReader(
	state: ClaudeStatsState,
): SessionStatsLineReader<ClaudeStatsState> {
	const counted = new Set(state.countedRequestKeys);

	const settlePending = () => {
		if (state.pending && state.pendingKey) {
			addRequest(state, state.pending);
			counted.add(state.pendingKey);
		}
		state.pending = null;
		state.pendingKey = null;
	};

	return {
		onLine(line) {
			if (!line.includes('"assistant"') && !line.includes('"user"')) return;
			let parsed: ClaudeLine;
			try {
				parsed = JSON.parse(line);
			} catch {
				return;
			}
			if (parsed.isSidechain) return;
			if (parsed.type === "user") {
				recordEventTime(state, parsed.timestamp);
				if (!parsed.isMeta && isPrompt(parsed.message?.content)) {
					state.turns += 1;
				}
				return;
			}
			if (parsed.type !== "assistant") return;
			recordEventTime(state, parsed.timestamp);
			const request = toRequest(parsed);
			if (!request) return;

			const key = `${parsed.message?.id ?? ""}|${parsed.requestId ?? ""}`;
			if (key === "|") {
				settlePending();
				addRequest(state, request);
			} else if (key === state.pendingKey) {
				state.pending = request;
			} else if (counted.has(key)) {
				return;
			} else {
				settlePending();
				state.pendingKey = key;
				state.pending = request;
			}
			state.model = request.model;
			state.lastRequestInput = requestInput(request);
		},
		finish() {
			state.countedRequestKeys = [...counted];
			return state;
		},
	};
}

export function claudeSessionStats(
	state: ClaudeStatsState,
): SessionStats | null {
	const totals = { ...state.totals };
	if (state.pending) {
		const { pending } = state;
		totals.uncachedInput += pending.uncachedInput;
		totals.cachedInput += pending.cachedInput;
		totals.cacheWrite5m += pending.cacheWrite5m;
		totals.cacheWrite1h += pending.cacheWrite1h;
		totals.output += pending.output;
		totals.costUsd += requestCost(pending);
		totals.requests += 1;
	}
	if (totals.requests === 0) return null;
	return {
		agent: "claude",
		model: state.model,
		turns: state.turns,
		contextUsed: state.lastRequestInput,
		contextMax: claudeContextWindow(state.model, state.lastRequestInput),
		inputTokens:
			totals.uncachedInput + totals.cacheWrite5m + totals.cacheWrite1h,
		cachedInputTokens: totals.cachedInput,
		outputTokens: totals.output,
		costUsd: totals.costUsd,
		startedAt: state.startedAt,
		lastEventAt: state.lastEventAt,
	};
}
