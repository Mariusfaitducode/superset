import {
	type ConversationState,
	isWaitingOnUser,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import type { BranchPlace } from "../buildRefBadges";

interface WorkspaceLike {
	id: string;
	projectId: string | null;
	branch: string;
	archivedAt?: number | null;
}

interface ConversationLike {
	workspaceId: string;
	state: ConversationState;
	since: number;
}

/**
 * Where each branch of a project lives: its git worktree, its Superset
 * workspace, and the conversation to open there (one waiting on the user
 * first, else the latest).
 */
export function indexBranchPlaces<
	TWorkspace extends WorkspaceLike,
	TConversation extends ConversationLike,
>({
	projectId,
	worktrees,
	workspaces,
	conversations,
}: {
	projectId: string;
	worktrees: readonly { path: string; branch: string | null }[];
	workspaces: readonly TWorkspace[];
	conversations: readonly TConversation[];
}): Map<string, BranchPlace<TWorkspace, TConversation>> {
	const places = new Map<string, BranchPlace<TWorkspace, TConversation>>();
	const placeFor = (branch: string) => {
		let place = places.get(branch);
		if (!place) {
			place = { worktreePath: null, workspace: null, conversation: null };
			places.set(branch, place);
		}
		return place;
	};
	for (const worktree of worktrees) {
		if (worktree.branch) placeFor(worktree.branch).worktreePath = worktree.path;
	}
	for (const workspace of workspaces) {
		if (workspace.archivedAt || workspace.projectId !== projectId) continue;
		const place = placeFor(workspace.branch);
		if (!place.workspace) place.workspace = workspace;
	}
	const branchByWorkspace = new Map(
		[...places].flatMap(([branch, place]) =>
			place.workspace ? [[place.workspace.id, branch] as const] : [],
		),
	);
	for (const conversation of conversations) {
		const branch = branchByWorkspace.get(conversation.workspaceId);
		if (!branch) continue;
		const place = placeFor(branch);
		const best = place.conversation;
		const waiting = isWaitingOnUser(conversation.state);
		const bestWaiting = best ? isWaitingOnUser(best.state) : false;
		if (
			!best ||
			(waiting && !bestWaiting) ||
			(waiting === bestWaiting && conversation.since > best.since)
		) {
			place.conversation = conversation;
		}
	}
	return places;
}
