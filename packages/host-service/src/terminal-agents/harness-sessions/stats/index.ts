import {
	claudeSessionStats,
	claudeStatsReader,
	emptyClaudeStats,
} from "./claude";
import { codexSessionStats, codexStatsReader, emptyCodexStats } from "./codex";
import type {
	SessionStats,
	SessionStatsAgent,
	SessionStatsLineReader,
	SessionStatsState,
} from "./types";

export type {
	SessionStats,
	SessionStatsAgent,
	SessionStatsCursor,
	SessionStatsState,
} from "./types";

export function isSessionStatsAgent(
	agentId: string,
): agentId is SessionStatsAgent {
	return agentId === "claude" || agentId === "codex";
}

export function emptySessionStats(agent: SessionStatsAgent): SessionStatsState {
	return agent === "claude" ? emptyClaudeStats() : emptyCodexStats();
}

export function sessionStatsReader(
	state: SessionStatsState,
): SessionStatsLineReader<SessionStatsState> {
	return state.agent === "claude"
		? claudeStatsReader(state)
		: codexStatsReader(state);
}

export function toSessionStats(state: SessionStatsState): SessionStats | null {
	return state.agent === "claude"
		? claudeSessionStats(state)
		: codexSessionStats(state);
}
