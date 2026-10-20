import { useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import { type SyntheticEvent, useState } from "react";
import { LuListChecks } from "react-icons/lu";
import { useNow } from "renderer/hooks/useNow";
import {
	buildSubagentSearch,
	navigateToV2Workspace,
} from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import {
	type ConversationTodo,
	useConversationTodosStore,
} from "renderer/stores/conversation-todos";
import { useIsTerminalVisible } from "renderer/stores/visible-terminals";
import type { DashboardSidebarWorkspaceIndentation } from "../../../../../../types";
import { ConversationTodos } from "./components/ConversationTodos";
import {
	type SidebarConversation,
	type SidebarSubagent,
	useWorkspaceConversations,
} from "./hooks/useWorkspaceConversations";
import {
	type ConversationState,
	isWaitingOnUser,
	waitingTintLevel,
} from "./utils/conversation-state";

const DOT_CLASS: Record<ConversationState, string> = {
	working: "bg-yellow-400 animate-pulse",
	request: "bg-violet-500",
	failed: "bg-red-500",
	unseen: "bg-green-500",
	seen: "bg-blue-500",
	idle: "bg-muted-foreground/40",
};

// Warms up the longer a conversation has waited on the user.
const TINT_CLASS = [
	"",
	"bg-orange-500/[0.07]",
	"bg-orange-500/[0.14]",
	"bg-red-500/[0.18]",
];

const EMPTY: ConversationTodo[] = [];

function stopRowEvent(event: SyntheticEvent) {
	event.stopPropagation();
}

function ConversationRow({
	workspaceId,
	conversation,
}: {
	workspaceId: string;
	conversation: SidebarConversation;
}) {
	const { t } = useLingui();
	// Minutes are the finest unit shown.
	const now = useNow(30_000).getTime();
	const navigate = useNavigate();
	const todos = useConversationTodosStore(
		(state) => state.todosByConversation[conversation.terminalId] ?? EMPTY,
	);
	const [todosOpen, setTodosOpen] = useState(false);
	const isVisible = useIsTerminalVisible(conversation.terminalId);
	const openTodos = todos.filter((todo) => !todo.done).length;

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
	const tint = waiting ? TINT_CLASS[waitingTintLevel(waitedMs)] : "";

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
					"group/conversation flex h-6 items-center gap-2 rounded-sm border border-transparent pr-1 pl-1 hover:bg-muted",
					tint,
					isVisible && "border-primary bg-primary/10",
				)}
			>
				<button
					type="button"
					onClick={open}
					aria-current={isVisible ? "true" : undefined}
					title={`${stateLabel[conversation.state]} · ${conversation.title}`}
					className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<span
						role="img"
						aria-label={stateLabel[conversation.state]}
						className={cn(
							"size-2 shrink-0 rounded-full",
							DOT_CLASS[conversation.state],
						)}
					/>
					<span
						className={cn(
							"min-w-0 flex-1 truncate text-xs",
							waiting ? "text-foreground" : "text-muted-foreground",
						)}
					>
						{conversation.title}
					</span>
				</button>
				<button
					type="button"
					aria-expanded={todosOpen}
					aria-label={t`To-dos`}
					onClick={() => setTodosOpen((value) => !value)}
					className={cn(
						"flex shrink-0 items-center gap-0.5 rounded-sm px-1 text-[10px] text-muted-foreground hover:bg-background hover:text-foreground",
						todos.length === 0 &&
							!todosOpen &&
							"opacity-0 focus-visible:opacity-100 group-hover/conversation:opacity-100",
					)}
				>
					<LuListChecks className="size-3" />
					{todos.length > 0 && <span>{openTodos > 0 ? openTodos : "✓"}</span>}
				</button>
				{waiting && (
					<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
						{formatCompactRelativeTime(Math.min(conversation.since, now), now)}
					</span>
				)}
			</div>
			{conversation.subagents.length > 0 && (
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
			{todosOpen && (
				<ConversationTodos conversationId={conversation.terminalId} />
			)}
		</li>
	);
}

/**
 * Every agent conversation of a workspace, under its row: one state dot per
 * conversation, a tint that warms with the time it has waited on the user,
 * and the user's own to-dos for it.
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
	const conversations = useWorkspaceConversations({ workspaceId, hostId });

	if (conversations.length === 0) return null;

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
		>
			<ul className="flex flex-col">
				{conversations.map((conversation) => (
					<ConversationRow
						key={conversation.terminalId}
						workspaceId={workspaceId}
						conversation={conversation}
					/>
				))}
			</ul>
		</div>
	);
}
