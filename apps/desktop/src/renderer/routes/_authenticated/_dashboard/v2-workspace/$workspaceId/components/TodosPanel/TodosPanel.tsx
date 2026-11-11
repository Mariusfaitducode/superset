import { Trans } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo } from "react";
import { ConversationTodos } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/components/ConversationTodos";
import { useWorkspaceConversations } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceConversations";
import { useWorkspaceTodos } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceTodos";
import { DashboardSidebarWorkspaceStatusProvider } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import { useTodosPanelStore } from "renderer/stores/todos-panel";
import { useVisibleTerminalsStore } from "renderer/stores/visible-terminals";
import { orderTodoSections } from "./orderTodoSections";

function blurActiveElement() {
	if (document.activeElement instanceof HTMLElement) {
		document.activeElement.blur();
	}
}

function TodosPanelContent({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}) {
	const navigate = useNavigate();
	const showTodos = useSidebarPreference("showTodos");
	const showAgentTodos = useSidebarPreference("showAgentTodos");
	const conversations = useWorkspaceConversations({ workspaceId, hostId });
	const todos = useWorkspaceTodos({
		workspaceId,
		hostId,
		terminalIds: conversations.map((conversation) => conversation.terminalId),
		enabled: showTodos,
	});
	const centerTerminalId = useVisibleTerminalsStore(
		(state) => state.terminalIdBySlot.center ?? null,
	);
	const storedFocus = useTodosPanelStore(
		(state) => state.focusByWorkspace[workspaceId] ?? null,
	);
	const setFocus = useTodosPanelStore((state) => state.setFocus);

	// The conversation on screen speaks for the focus; a click on a to-do
	// button navigates there too, so both agree after a sidebar click.
	const centerIsConversation = conversations.some(
		(conversation) => conversation.terminalId === centerTerminalId,
	);
	useEffect(() => {
		if (centerIsConversation && centerTerminalId) {
			setFocus(workspaceId, centerTerminalId);
		}
	}, [centerIsConversation, centerTerminalId, setFocus, workspaceId]);
	const focusedTerminalId = centerIsConversation
		? centerTerminalId
		: storedFocus;

	const sections = useMemo(
		() =>
			orderTodoSections({
				conversations,
				todosByTerminal: todos.byTerminal,
				focusedTerminalId,
				includeAgentTodos: showAgentTodos,
			}),
		[conversations, todos.byTerminal, focusedTerminalId, showAgentTodos],
	);

	const openConversation = (terminalId: string) => {
		setFocus(workspaceId, terminalId);
		void navigateToV2Workspace(workspaceId, navigate, {
			search: { terminalId, focusRequestId: crypto.randomUUID() },
		});
	};

	if (!showTodos) {
		return (
			<EmptyState>
				<Trans>To-dos are turned off in Settings, Sidebar.</Trans>
			</EmptyState>
		);
	}
	if (!todos.available) return null;
	if (sections.length === 0) {
		return (
			<EmptyState>
				{conversations.length === 0 ? (
					<Trans>No agent conversation in this workspace.</Trans>
				) : (
					<Trans>
						No to-dos yet. Use a conversation's to-do button to add one.
					</Trans>
				)}
			</EmptyState>
		);
	}

	return (
		<div className="h-full min-h-0 overflow-y-auto px-2 py-3">
			<ul className="flex flex-col gap-4">
				{sections.map(({ conversation, todos: list, focused }) => {
					const open = list.filter((todo) => !todo.done).length;
					return (
						<li
							key={conversation.terminalId}
							className={cn(
								"border-l-2 pl-2",
								focused ? "border-foreground/40" : "border-transparent",
							)}
						>
							<button
								type="button"
								onClick={() => openConversation(conversation.terminalId)}
								aria-current={focused ? "true" : undefined}
								title={conversation.title}
								className={cn(
									"mb-0.5 flex w-full min-w-0 items-baseline gap-2 rounded-sm px-1 text-left text-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
									focused
										? "font-medium text-foreground"
										: "text-muted-foreground",
								)}
							>
								<span className="min-w-0 flex-1 truncate">
									{conversation.title}
								</span>
								{open > 0 && (
									<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
										{open}
									</span>
								)}
							</button>
							<ConversationTodos
								// A new focus remounts the list so its field takes the cursor.
								key={focused ? "focused" : "other"}
								terminalId={conversation.terminalId}
								todos={list}
								actions={todos.actions}
								onClose={blurActiveElement}
								inline={false}
								autoFocus={focused}
							/>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function EmptyState({ children }: { children: ReactNode }) {
	return (
		<div className="flex h-full items-center justify-center p-6">
			<p className="max-w-56 text-center text-xs text-muted-foreground">
				{children}
			</p>
		</div>
	);
}

/**
 * Every to-do list of a workspace's conversations, in the right panel: the
 * conversation in focus first, marked by a thin rule, then the others that
 * have to-dos. Each heading opens its conversation.
 */
export function TodosPanel({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}) {
	const workspaces = useMemo(
		() => [{ id: workspaceId, hostId }],
		[workspaceId, hostId],
	);
	return (
		<DashboardSidebarWorkspaceStatusProvider
			workspaces={workspaces}
			activeWorkspaceId={null}
		>
			<TodosPanelContent workspaceId={workspaceId} hostId={hostId} />
		</DashboardSidebarWorkspaceStatusProvider>
	);
}
