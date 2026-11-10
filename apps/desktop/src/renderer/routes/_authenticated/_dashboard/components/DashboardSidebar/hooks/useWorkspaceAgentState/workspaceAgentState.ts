import {
	type AgentState,
	agentStateFromConversation,
	agentStateFromPaneStatus,
	countLiveChildren,
	isBlockedOnUser,
	mostUrgentAgentState,
} from "renderer/lib/agent-state";
import type { ActivePaneStatus } from "shared/tabs-types";
import {
	type ConversationState,
	deriveConversationState,
} from "../../components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";

export interface WorkspaceAgentState {
	state: AgentState;
	/** Conversations that cannot go on without the user. */
	blockedCount: number;
	/** Host clock, ms: since when the longest-waiting conversation waits. */
	waitingSince: number | null;
}

export interface WorkspaceAgentBinding {
	terminalId: string;
	lastEventType: string;
	lastEventAt: number;
}

/** A workspace takes the most urgent state of its conversations. */
export function deriveWorkspaceAgentState({
	status,
	sandboxStatus,
	bindings,
	terminalSeenAt,
}: {
	status: ActivePaneStatus | null;
	sandboxStatus: "provisioning" | "failed" | null;
	bindings: Iterable<WorkspaceAgentBinding>;
	terminalSeenAt: Readonly<Record<string, number>>;
}): WorkspaceAgentState {
	const states: AgentState[] = [agentStateFromPaneStatus(status)];
	if (sandboxStatus === "failed") states.push("failed");
	let blockedCount = 0;
	let waitingSince: number | null = null;
	for (const binding of bindings) {
		const conversationState: ConversationState = deriveConversationState({
			lastEventType: binding.lastEventType,
			lastEventAt: binding.lastEventAt,
			lastSeenAt: terminalSeenAt[binding.terminalId],
			liveChildren: countLiveChildren(binding),
		});
		const state = agentStateFromConversation(conversationState);
		states.push(state);
		if (isBlockedOnUser(state)) blockedCount += 1;
		if (isBlockedOnUser(state) || state === "unseen") {
			waitingSince =
				waitingSince === null
					? binding.lastEventAt
					: Math.min(waitingSince, binding.lastEventAt);
		}
	}
	return { state: mostUrgentAgentState(states), blockedCount, waitingSince };
}
