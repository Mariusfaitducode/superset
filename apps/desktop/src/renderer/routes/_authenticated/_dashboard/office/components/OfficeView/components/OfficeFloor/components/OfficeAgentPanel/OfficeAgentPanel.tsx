import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { LuFolderOpen, LuSquareTerminal, LuX } from "react-icons/lu";
import { ConversationTodos } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/components/ConversationTodos";
import type { SidebarConversation } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceConversations";
import { useWorkspaceTodos } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceTodos";
import { useConversationStateLabels } from "renderer/routes/_authenticated/_dashboard/office/hooks/useConversationStateLabels";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";

/** The selected agent: its state, its to-dos, and a way to its terminal. */
export function OfficeAgentPanel({
	workspace,
	conversation,
	onClose,
}: {
	workspace: { id: string; hostId: string; name: string };
	conversation: SidebarConversation;
	onClose: () => void;
}) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const stateLabels = useConversationStateLabels();
	const showAgentTodos = useSidebarPreference("showAgentTodos");
	const todos = useWorkspaceTodos({
		workspaceId: workspace.id,
		hostId: workspace.hostId,
		terminalIds: [conversation.terminalId],
		enabled: true,
	});
	const list = (todos.byTerminal.get(conversation.terminalId) ?? []).filter(
		(todo) => showAgentTodos || todo.author !== "agent",
	);

	const openTerminal = () => {
		void navigateToV2Workspace(workspace.id, navigate, {
			search: {
				terminalId: conversation.terminalId,
				focusRequestId: crypto.randomUUID(),
			},
		});
	};

	return (
		<aside className="flex w-80 shrink-0 flex-col border-l border-border bg-background">
			<div className="flex items-start gap-2 border-b border-border p-3">
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-medium">{conversation.title}</p>
					<p className="truncate text-xs text-muted-foreground">
						{stateLabels[conversation.state]} · {workspace.name}
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label={t`Close`}
					onClick={onClose}
				>
					<LuX className="size-3.5" />
				</Button>
			</div>
			<div className="flex gap-2 p-3">
				<Button size="sm" className="flex-1" onClick={openTerminal}>
					<LuSquareTerminal className="size-3.5" />
					<Trans>Open terminal</Trans>
				</Button>
				<Button
					size="sm"
					variant="outline"
					aria-label={t`Open workspace`}
					onClick={() => void navigateToV2Workspace(workspace.id, navigate)}
				>
					<LuFolderOpen className="size-3.5" />
				</Button>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
				<p className="mb-1 text-xs font-medium text-muted-foreground">
					<Trans>To-dos</Trans>
				</p>
				{todos.available ? (
					<ConversationTodos
						terminalId={conversation.terminalId}
						todos={list}
						actions={todos.actions}
					/>
				) : (
					<p className="text-xs text-muted-foreground">
						<Trans>This host is too old to keep to-dos.</Trans>
					</p>
				)}
			</div>
		</aside>
	);
}
