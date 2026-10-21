import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { useMemo } from "react";
import { LuListChecks } from "react-icons/lu";
import {
	type ConversationState,
	deriveConversationState,
	isWaitingOnUser,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import { compareTodos } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/todo-order";
import { WorkspaceLabelPills } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels";
import { useV2NotificationStore } from "renderer/stores/v2-notifications";
import { useHostAgentBindings, useHostTodos } from "./useHostInsights";

const DOT_CLASS: Record<ConversationState, string> = {
	working: "bg-yellow-400 animate-pulse",
	request: "bg-violet-500",
	failed: "bg-red-500",
	unseen: "bg-green-500",
	seen: "bg-blue-500",
	idle: "bg-muted-foreground/40",
};

/**
 * What the sidebar shows about a workspace, on its board card or list row:
 * labels, one dot per agent conversation, and its most urgent open to-do.
 */
export function WorkspaceInsights({
	workspaceId,
	hostId,
	className,
}: {
	workspaceId: string;
	hostId: string;
	className?: string;
}) {
	const { t } = useLingui();
	const bindings = useHostAgentBindings(hostId);
	const todos = useHostTodos(hostId);
	const terminalSeenAt = useV2NotificationStore(
		(state) => state.terminalSeenAt,
	);

	const states = useMemo(
		() =>
			bindings
				.filter(
					(binding) =>
						binding.workspaceId === workspaceId && binding.endedAt == null,
				)
				.sort((a, b) => a.startedAt - b.startedAt)
				.map((binding) =>
					deriveConversationState({
						lastEventType: binding.lastEventType,
						lastEventAt: binding.lastEventAt,
						lastSeenAt: terminalSeenAt[binding.terminalId],
					}),
				),
		[bindings, workspaceId, terminalSeenAt],
	);
	const openTodos = useMemo(
		() =>
			todos
				.filter((todo) => todo.workspaceId === workspaceId && !todo.done)
				.sort(compareTodos),
		[todos, workspaceId],
	);
	const waiting = states.filter(isWaitingOnUser).length;
	const topTodo = openTodos[0];

	return (
		<div className={cn("flex min-w-0 flex-col gap-1", className)}>
			<WorkspaceLabelPills workspaceId={workspaceId} hostId={hostId} />
			{states.length > 0 && (
				<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					<span className="flex items-center gap-0.5">
						{states.map((state, index) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: dots carry no identity, only a state in start order
								key={index}
								className={cn("size-1.5 rounded-full", DOT_CLASS[state])}
							/>
						))}
					</span>
					<span>
						{waiting > 0
							? t`${states.length} agents · ${waiting} waiting for you`
							: t`${states.length} agents`}
					</span>
				</div>
			)}
			{topTodo && (
				<div
					className="flex min-w-0 items-center gap-1 text-[11px]"
					title={openTodos.map((todo) => todo.text).join("\n")}
				>
					<LuListChecks
						className={cn(
							"size-3 shrink-0",
							topTodo.priority === "high"
								? "text-red-500"
								: "text-muted-foreground",
						)}
					/>
					<span className="min-w-0 truncate">{topTodo.text}</span>
					{openTodos.length > 1 && (
						<span className="shrink-0 text-muted-foreground">
							+{openTodos.length - 1}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
