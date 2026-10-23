import {
	type ConversationState,
	isWaitingOnUser,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";

interface WorkspaceLike {
	id: string;
	projectId: string | null;
	branch: string;
	archivedAt?: number | null;
}

interface ConversationLike {
	terminalId: string;
	workspaceId: string;
	state: ConversationState;
	since: number;
}

/** Index live workspaces by project and branch, the way a PR names its head. */
export function indexWorkspacesByBranch<T extends WorkspaceLike>(
	workspaces: readonly T[],
): Map<string, T> {
	const index = new Map<string, T>();
	for (const workspace of workspaces) {
		if (workspace.archivedAt || !workspace.projectId) continue;
		const key = branchKey(workspace.projectId, workspace.branch);
		if (!index.has(key)) index.set(key, workspace);
	}
	return index;
}

export function branchKey(projectId: string, branch: string): string {
	return `${projectId}\0${branch}`;
}

/** The conversation to open for a workspace: one waiting on the user, else the latest. */
export function pickWorkspaceConversation<T extends ConversationLike>(
	conversations: readonly T[],
	workspaceId: string,
): T | null {
	let best: T | null = null;
	for (const conversation of conversations) {
		if (conversation.workspaceId !== workspaceId) continue;
		if (!best) {
			best = conversation;
			continue;
		}
		const waiting = isWaitingOnUser(conversation.state);
		const bestWaiting = isWaitingOnUser(best.state);
		if (
			(waiting && !bestWaiting) ||
			(waiting === bestWaiting && conversation.since > best.since)
		) {
			best = conversation;
		}
	}
	return best;
}
