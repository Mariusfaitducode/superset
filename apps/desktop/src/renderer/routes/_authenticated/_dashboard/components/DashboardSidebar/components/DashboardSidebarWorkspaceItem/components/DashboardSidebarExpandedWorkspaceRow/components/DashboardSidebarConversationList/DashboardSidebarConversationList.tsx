import { useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import {
	type CSSProperties,
	type SyntheticEvent,
	useMemo,
	useState,
} from "react";
import { LuBot, LuListChecks, LuMessageSquarePlus } from "react-icons/lu";
import { usePresetIcon } from "renderer/assets/app-icons/preset-icons";
import { useNow } from "renderer/hooks/useNow";
import {
	buildSubagentSearch,
	navigateToV2Workspace,
} from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { RenameInput } from "renderer/screens/main/components/WorkspaceSidebar/RenameInput";
import {
	resolveFolderOptions,
	useSidebarFolderOptionsStore,
} from "renderer/stores/sidebar-folder-options";
import {
	type ActiveMarker,
	COMPACT_ROW_VARS,
	useSidebarPreference,
	type WaitingTint,
} from "renderer/stores/sidebar-preferences";
import { useIsTerminalVisible } from "renderer/stores/visible-terminals";
import { useDashboardSidebarFolder } from "../../../../../../providers/DashboardSidebarFolderProvider";
import type { DashboardSidebarWorkspaceIndentation } from "../../../../../../types";
import { ConversationStats } from "./components/ConversationStats";
import { ConversationTodos } from "./components/ConversationTodos";
import { useRenameConversation } from "./hooks/useRenameConversation";
import {
	type SidebarConversation,
	type SidebarSubagent,
	useWorkspaceConversations,
} from "./hooks/useWorkspaceConversations";
import {
	type ConversationTodo,
	type TodoActions,
	useWorkspaceTodos,
} from "./hooks/useWorkspaceTodos";
import {
	type ConversationState,
	isWaitingOnUser,
	waitingTintLevel,
} from "./utils/conversation-state";

export const DOT_CLASS: Record<ConversationState, string> = {
	working: "bg-[var(--sb-state-working)] animate-pulse",
	request: "bg-[var(--sb-state-request)]",
	failed: "bg-[var(--sb-state-failed)]",
	unseen: "bg-[var(--sb-state-unseen)]",
	seen: "bg-[var(--sb-state-seen)]",
	idle: "bg-[var(--sb-state-idle)]",
};

export const ACTIVE_MARKER_CLASS: Record<ActiveMarker, string> = {
	outline:
		"border-primary bg-[color-mix(in_oklab,var(--primary)_var(--sb-marker-fill),transparent)]",
	bar: "bg-[color-mix(in_oklab,var(--primary)_var(--sb-marker-fill),transparent)]",
	fill: "bg-[color-mix(in_oklab,var(--primary)_calc(var(--sb-marker-fill)*1.8),transparent)]",
};

export function conversationRowStyle({
	isActive,
	activeMarker,
	folderColor,
}: {
	isActive: boolean;
	activeMarker: ActiveMarker;
	folderColor: string | null;
}): CSSProperties | undefined {
	if (isActive && activeMarker === "bar") {
		return { boxShadow: "inset var(--sb-band) 0 var(--primary)" };
	}
	if (folderColor) {
		return { boxShadow: `inset var(--sb-band) 0 ${folderColor}` };
	}
	return undefined;
}

// Warms up the longer a conversation has waited on the user.
const TINT_CLASS: Record<Exclude<WaitingTint, "off">, string[]> = {
	subtle: [
		"",
		"bg-orange-500/[0.07]",
		"bg-orange-500/[0.14]",
		"bg-red-500/[0.18]",
	],
	strong: [
		"",
		"bg-orange-500/[0.14]",
		"bg-orange-500/[0.26]",
		"bg-red-500/[0.32]",
	],
};

function stopRowEvent(event: SyntheticEvent) {
	event.stopPropagation();
}

function AgentAvatar({
	conversation,
	label,
}: {
	conversation: SidebarConversation;
	label: string;
}) {
	const iconUrl = usePresetIcon(conversation.agentId);
	return (
		<span className="relative flex size-3.5 shrink-0 items-center justify-center">
			{iconUrl ? (
				<img src={iconUrl} alt="" className="size-3.5 object-contain" />
			) : (
				<LuBot className="size-3.5" />
			)}
			<span
				role="img"
				aria-label={label}
				className={cn(
					"absolute -right-1 -bottom-0.5 size-2 rounded-full ring-2 ring-sidebar",
					DOT_CLASS[conversation.state],
				)}
			/>
		</span>
	);
}

function ConversationRow({
	workspaceId,
	hostId,
	conversation,
	todos,
	todoActions,
	showSubagents,
	folderColor,
}: {
	workspaceId: string;
	hostId: string;
	conversation: SidebarConversation;
	/** Null when the host is too old to keep to-dos, or hidden for this folder. */
	todos: ConversationTodo[] | null;
	todoActions: TodoActions;
	showSubagents: boolean;
	/** Null when the conversation is not striped with its folder's color. */
	folderColor: string | null;
}) {
	const { t } = useLingui();
	// Minutes are the finest unit shown.
	const now = useNow(30_000).getTime();
	const navigate = useNavigate();
	const [todosOpen, setTodosOpen] = useState(false);
	const [renameValue, setRenameValue] = useState<string | null>(null);
	const renameConversation = useRenameConversation({ workspaceId, hostId });
	const isVisible = useIsTerminalVisible(conversation.terminalId);
	const showTodos = todos !== null;
	const activeMarker = useSidebarPreference("activeMarker");
	const showTurnTime = useSidebarPreference("showTurnTime");
	const showQueuedPrompts = useSidebarPreference("showQueuedPrompts");
	const waitingTint = useSidebarPreference("waitingTint");
	const openTodos = (todos ?? []).filter((todo) => !todo.done).length;
	const urgentTodos = (todos ?? []).some(
		(todo) => !todo.done && todo.priority === "high",
	);

	const stateLabel: Record<ConversationState, string> = {
		working: t`Working`,
		request: t`Needs your approval`,
		failed: t`Stopped on an error`,
		unseen: t`Finished — not opened yet`,
		seen: t`Waiting for your reply`,
		idle: t`Idle`,
	};

	const waiting = isWaitingOnUser(conversation.state);
	const waitedMs = now - conversation.since;
	const tint =
		waiting && waitingTint !== "off"
			? TINT_CLASS[waitingTint][waitingTintLevel(waitedMs)]
			: "";
	const turnStartedAt = showTurnTime ? conversation.turnStartedAt : null;

	const submitRename = () => {
		if (renameValue === null) return;
		setRenameValue(null);
		if (renameValue.trim() === conversation.title) return;
		renameConversation(conversation.terminalId, renameValue).catch(() =>
			toast.error(t`Failed to rename session`),
		);
	};

	const open = () => {
		void navigateToV2Workspace(workspaceId, navigate, {
			search: {
				terminalId: conversation.terminalId,
				focusRequestId: crypto.randomUUID(),
			},
		});
	};

	const openSubagent = (subagent: SidebarSubagent) => {
		void navigateToV2Workspace(workspaceId, navigate, {
			search: {
				...buildSubagentSearch({
					terminalId: conversation.terminalId,
					subagentId: subagent.id,
					agentId: conversation.agentId,
					...(subagent.agentType ? { agentType: subagent.agentType } : {}),
				}),
				focusRequestId: crypto.randomUUID(),
			},
		});
	};

	return (
		<li>
			<div
				className={cn(
					"group/conversation flex h-[var(--sb-conv-h)] items-center gap-2 rounded-sm border border-transparent pr-1 pl-1 hover:bg-muted",
					folderColor && "pl-[calc(var(--sb-band)+4px)]",
					tint,
					isVisible && ACTIVE_MARKER_CLASS[activeMarker],
				)}
				style={conversationRowStyle({
					isActive: isVisible,
					activeMarker,
					folderColor,
				})}
			>
				{renameValue !== null ? (
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<AgentAvatar
							conversation={conversation}
							label={stateLabel[conversation.state]}
						/>
						<RenameInput
							value={renameValue}
							onChange={setRenameValue}
							onSubmit={submitRename}
							onCancel={() => setRenameValue(null)}
							className="h-5 min-w-0 flex-1 -ml-1 border-none bg-transparent px-1 py-0 text-[length:var(--sb-conv-text)] outline-none"
						/>
					</div>
				) : (
					<button
						type="button"
						onClick={open}
						onDoubleClick={() => setRenameValue(conversation.title)}
						aria-current={isVisible ? "true" : undefined}
						title={`${stateLabel[conversation.state]} · ${conversation.title}`}
						className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						<AgentAvatar
							conversation={conversation}
							label={stateLabel[conversation.state]}
						/>
						<span
							className={cn(
								"min-w-0 flex-1 truncate text-[length:var(--sb-conv-text)]",
								waiting || conversation.state === "working"
									? "text-foreground"
									: "text-muted-foreground",
							)}
						>
							{conversation.title}
						</span>
					</button>
				)}
				{showQueuedPrompts && conversation.queuedPrompts > 0 && (
					<span
						className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"
						title={t`${conversation.queuedPrompts} queued messages`}
					>
						<LuMessageSquarePlus className="size-3" />
						{conversation.queuedPrompts}
					</span>
				)}
				<ConversationStats
					workspaceId={workspaceId}
					hostId={hostId}
					terminalId={conversation.terminalId}
					lastEventAt={conversation.since}
					working={conversation.state === "working"}
				/>
				{showTodos && (
					<button
						type="button"
						aria-expanded={todosOpen}
						aria-label={t`To-dos`}
						onClick={() => setTodosOpen((value) => !value)}
						className={cn(
							"flex shrink-0 items-center gap-0.5 rounded-sm px-1 text-[10px] text-muted-foreground hover:bg-background hover:text-foreground",
							urgentTodos && "text-red-500",
							todos?.length === 0 &&
								!todosOpen &&
								"opacity-0 focus-visible:opacity-100 group-hover/conversation:opacity-100",
						)}
					>
						<LuListChecks className="size-3" />
						{(todos?.length ?? 0) > 0 && (
							<span>{openTodos > 0 ? openTodos : "✓"}</span>
						)}
					</button>
				)}
				{waiting ? (
					<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
						{formatCompactRelativeTime(Math.min(conversation.since, now), now)}
					</span>
				) : turnStartedAt !== null ? (
					<span
						className="shrink-0 text-[10px] tabular-nums text-[color:var(--sb-state-working)]"
						title={t`Current turn running`}
					>
						{formatCompactRelativeTime(Math.min(turnStartedAt, now), now)}
					</span>
				) : null}
			</div>
			{showSubagents && conversation.subagents.length > 0 && (
				<ul className="ml-[3px] border-l border-border pl-2">
					{conversation.subagents.map((subagent) => (
						<li key={subagent.id}>
							<button
								type="button"
								onClick={() => openSubagent(subagent)}
								className="flex h-5 w-full items-center gap-1.5 rounded-sm px-1 text-left text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							>
								<span className="min-w-0 flex-1 truncate text-[11px]">
									{subagent.agentType ?? t`Subagent`}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{showTodos && todosOpen && (
				<ConversationTodos
					terminalId={conversation.terminalId}
					todos={todos ?? []}
					actions={todoActions}
					onClose={() => setTodosOpen(false)}
				/>
			)}
		</li>
	);
}

/**
 * Every agent conversation of a workspace, under its row: the agent's icon
 * with a state dot, a tint that warms with the time it has waited on the
 * user, its turn time and stats, and the user's own to-dos for it.
 */
export function DashboardSidebarConversationList({
	workspaceId,
	hostId,
	isInSection = false,
	indentation,
}: {
	workspaceId: string;
	hostId: string;
	isInSection?: boolean;
	indentation?: DashboardSidebarWorkspaceIndentation;
}) {
	const folder = useDashboardSidebarFolder();
	const byFolder = useSidebarFolderOptionsStore((state) => state.byFolder);
	const folderOptions = useMemo(
		() => resolveFolderOptions(byFolder, folder.projectId, folder.groupId),
		[byFolder, folder.projectId, folder.groupId],
	);
	const showConversations =
		useSidebarPreference("showConversations") &&
		!folderOptions.hideConversations;
	const showIdleConversations =
		useSidebarPreference("showIdleConversations") &&
		!folderOptions.hideIdleConversations;
	const showSubagents =
		useSidebarPreference("showSubagents") && !folderOptions.hideSubagents;
	const folderColorOnConversations = useSidebarPreference(
		"folderColorOnConversations",
	);
	const folderColor = folderColorOnConversations ? folder.color : null;
	const allConversations = useWorkspaceConversations({
		workspaceId,
		hostId,
		enabled: showConversations,
	});
	const conversations = showIdleConversations
		? allConversations
		: allConversations.filter((conversation) => conversation.state !== "idle");
	const showTodos =
		useSidebarPreference("showTodos") && !folderOptions.hideTodos;
	const showAgentTodos = useSidebarPreference("showAgentTodos");
	const todos = useWorkspaceTodos({
		workspaceId,
		hostId,
		terminalIds: allConversations.map(
			(conversation) => conversation.terminalId,
		),
		enabled: showConversations && showTodos,
	});
	const todosFor = (terminalId: string): ConversationTodo[] | null => {
		if (!todos.available || !showTodos) return null;
		const list = todos.byTerminal.get(terminalId) ?? [];
		return showAgentTodos
			? list
			: list.filter((todo) => todo.author !== "agent");
	};

	if (!showConversations || conversations.length === 0) return null;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: only keeps clicks and drags in the list from activating or dragging the workspace row
		<div
			className={cn(
				"pr-2 pb-1",
				indentation === "top-level"
					? "pl-[22px]"
					: indentation === "grouped" || isInSection
						? "pl-[46px]"
						: "pl-[38px]",
			)}
			onMouseDown={stopRowEvent}
			onTouchStart={stopRowEvent}
			onClick={stopRowEvent}
			onDoubleClick={stopRowEvent}
			onKeyDown={stopRowEvent}
			style={
				folderOptions.compactRows
					? (COMPACT_ROW_VARS as CSSProperties)
					: undefined
			}
		>
			<ul className="flex flex-col">
				{conversations.map((conversation) => (
					<ConversationRow
						key={conversation.terminalId}
						workspaceId={workspaceId}
						hostId={hostId}
						conversation={conversation}
						todos={todosFor(conversation.terminalId)}
						todoActions={todos.actions}
						showSubagents={showSubagents}
						folderColor={folderColor}
					/>
				))}
			</ul>
		</div>
	);
}
