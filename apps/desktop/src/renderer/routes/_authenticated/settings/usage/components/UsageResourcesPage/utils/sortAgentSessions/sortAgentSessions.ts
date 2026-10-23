import type { AgentSortOption } from "../../stores/agentCleanup";
import type { AgentSessionView } from "../../types";
import { getLastAnsweredAt } from "../selectStaleSessions";

/** "last-reply" puts the longest-unanswered first: the cleanup candidates. */
export function sortAgentSessions(
	sessions: AgentSessionView[],
	sortBy: AgentSortOption,
): AgentSessionView[] {
	const sorted = [...sessions];
	if (sortBy === "memory") return sorted.sort((a, b) => b.memory - a.memory);
	if (sortBy === "name") {
		return sorted.sort((a, b) => a.title.localeCompare(b.title));
	}
	return sorted.sort(
		(a, b) => (getLastAnsweredAt(a) ?? 0) - (getLastAnsweredAt(b) ?? 0),
	);
}
