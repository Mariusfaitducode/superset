import { useEffect } from "react";
import {
	type ConversationWorkStates,
	useConversationWorkStates,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useConversationWorkStates";
import {
	type SidebarConversation,
	useWorkspaceConversations,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceConversations";
import {
	type ConversationTodo,
	useWorkspaceTodos,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceTodos";

export interface OfficeWorkspaceReport {
	conversations: SidebarConversation[];
	/** Null on hosts too old to keep to-dos. */
	todosByTerminal: ReadonlyMap<string, ConversationTodo[]> | null;
	workStates: ConversationWorkStates;
}

/**
 * Reads one workspace's conversations, to-dos and work states with the
 * sidebar's own hooks and hands them up, so the office draws every
 * workspace in one canvas. Renders nothing.
 */
export function OfficeWorkspaceSource({
	workspaceId,
	hostId,
	onReport,
}: {
	workspaceId: string;
	hostId: string;
	onReport: (workspaceId: string, report: OfficeWorkspaceReport | null) => void;
}) {
	const conversations = useWorkspaceConversations({ workspaceId, hostId });
	const todos = useWorkspaceTodos({
		workspaceId,
		hostId,
		terminalIds: conversations.map((conversation) => conversation.terminalId),
		enabled: true,
	});
	const todosByTerminal = todos.available ? todos.byTerminal : null;
	const workStates = useConversationWorkStates({
		hostId,
		conversations,
		todosByTerminal,
	});

	useEffect(() => {
		onReport(workspaceId, { conversations, todosByTerminal, workStates });
	}, [workspaceId, conversations, todosByTerminal, workStates, onReport]);

	useEffect(() => () => onReport(workspaceId, null), [workspaceId, onReport]);

	return null;
}
