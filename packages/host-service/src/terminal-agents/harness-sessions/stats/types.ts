import type { TokenCounts } from "../../../trpc/router/usage/history/pricing";

export type SessionStatsAgent = "claude" | "codex";

export interface SessionStats {
	agent: SessionStatsAgent;
	model: string | null;
	turns: number;
	contextUsed: number;
	contextMax: number | null;
	/** Input billed at the full rate, cache writes included. */
	inputTokens: number;
	cachedInputTokens: number;
	outputTokens: number;
	/** API-list-rate estimate, never money spent. */
	costUsd: number | null;
	startedAt: number | null;
	lastEventAt: number | null;
}

export interface TokenTotals extends TokenCounts {
	costUsd: number;
	requests: number;
}

interface CommonState {
	model: string | null;
	turns: number;
	startedAt: number | null;
	lastEventAt: number | null;
	totals: TokenTotals;
}

export interface ClaudeRequest extends TokenCounts {
	model: string;
}

/**
 * Claude writes one line per content block, each with the usage so far, so
 * a request counts once its last line is known: the next request starts or
 * the read ends.
 */
export interface ClaudeStatsState extends CommonState {
	agent: "claude";
	countedRequestKeys: string[];
	pendingKey: string | null;
	pending: ClaudeRequest | null;
	lastRequestInput: number;
}

export interface CodexStatsState extends CommonState {
	agent: "codex";
	lastDeltaSignature: string | null;
	reportedTotals: {
		input: number;
		cachedInput: number;
		output: number;
	} | null;
	contextUsed: number;
	reportedContextWindow: number | null;
}

/** Plain data, so it crosses the worker boundary and resumes a later read. */
export type SessionStatsState = ClaudeStatsState | CodexStatsState;

export interface SessionStatsCursor {
	path: string;
	size: number;
	mtimeMs: number;
	/** Bytes up to the last complete line. */
	offset: number;
	state: SessionStatsState;
}

export interface SessionStatsLineReader<State extends SessionStatsState> {
	onLine(line: string): void;
	finish(): State;
}
