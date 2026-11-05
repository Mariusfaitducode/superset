import type { ConversationState } from "../../DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";

export interface AgentSummary {
	/** Blocked on the user: a permission request or an error. */
	needsYou: number;
	working: number;
	/** Finished turns, opened or not. */
	done: number;
	/** Finished turns not opened yet. */
	unseen: number;
}

/** Counts a workspace's agent conversations by what they ask of the user. */
export function summarizeAgents(
	conversations: Iterable<{ state: ConversationState }>,
): AgentSummary {
	const summary: AgentSummary = { needsYou: 0, working: 0, done: 0, unseen: 0 };
	for (const { state } of conversations) {
		if (state === "request" || state === "failed") summary.needsYou += 1;
		else if (state === "working") summary.working += 1;
		else if (state === "unseen" || state === "seen") {
			summary.done += 1;
			if (state === "unseen") summary.unseen += 1;
		}
	}
	return summary;
}
