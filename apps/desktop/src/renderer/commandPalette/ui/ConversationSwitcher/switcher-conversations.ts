import {
	AGENT_IDENTITY_LABELS,
	type AgentIdentityId,
} from "@superset/shared/agent-catalog";
import {
	type ConversationState,
	deriveConversationState,
	isWaitingOnUser,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import { pickConversationTitle } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-title";

export interface SwitcherBinding {
	terminalId: string;
	workspaceId: string;
	agentId: AgentIdentityId;
	lastEventType: string;
	lastEventAt: number;
}

export interface SwitcherWorkspace {
	name: string;
	projectName: string | null;
}

export interface SwitcherTitles {
	customTitle: string | null;
	runtimeTitle: string | null;
}

export interface SwitcherConversation {
	terminalId: string;
	workspaceId: string;
	agentId: AgentIdentityId;
	agentLabel: string;
	title: string;
	workspaceName: string;
	projectName: string | null;
	state: ConversationState;
	/** Host clock, ms: when the conversation entered its current state. */
	since: number;
}

/**
 * Every live agent conversation across workspaces, titled like the sidebar.
 * Conversations waiting on the user come first, then the rest; the most
 * recent state change leads within each group.
 */
export function buildSwitcherConversations({
	bindings,
	workspaces,
	terminalSeenAt,
	titles,
	tabNames,
}: {
	bindings: Iterable<SwitcherBinding>;
	workspaces: ReadonlyMap<string, SwitcherWorkspace>;
	terminalSeenAt: Readonly<Record<string, number>>;
	titles: ReadonlyMap<string, SwitcherTitles>;
	tabNames: ReadonlyMap<string, string>;
}): SwitcherConversation[] {
	const conversations: SwitcherConversation[] = [];
	for (const binding of bindings) {
		// Bindings of a deleted workspace can outlive it in the query cache.
		const workspace = workspaces.get(binding.workspaceId);
		if (!workspace) continue;
		const agentLabel =
			AGENT_IDENTITY_LABELS[binding.agentId] ?? binding.agentId;
		const title = titles.get(binding.terminalId);
		conversations.push({
			terminalId: binding.terminalId,
			workspaceId: binding.workspaceId,
			agentId: binding.agentId,
			agentLabel,
			title: pickConversationTitle({
				customTitle: title?.customTitle ?? null,
				tabName: tabNames.get(binding.terminalId) ?? null,
				runtimeTitle: title?.runtimeTitle ?? null,
				agentLabel,
			}),
			workspaceName: workspace.name,
			projectName: workspace.projectName,
			state: deriveConversationState({
				lastEventType: binding.lastEventType,
				lastEventAt: binding.lastEventAt,
				lastSeenAt: terminalSeenAt[binding.terminalId],
			}),
			since: binding.lastEventAt,
		});
	}
	return conversations.sort(
		(a, b) =>
			Number(isWaitingOnUser(b.state)) - Number(isWaitingOnUser(a.state)) ||
			b.since - a.since,
	);
}

/** Every word of the query must appear in the title, workspace, project or agent. */
export function matchesSwitcherQuery(
	conversation: SwitcherConversation,
	query: string,
): boolean {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	const haystack = [
		conversation.title,
		conversation.workspaceName,
		conversation.projectName ?? "",
		conversation.agentLabel,
	]
		.join(" ")
		.toLowerCase();
	return words.every((word) => haystack.includes(word));
}
