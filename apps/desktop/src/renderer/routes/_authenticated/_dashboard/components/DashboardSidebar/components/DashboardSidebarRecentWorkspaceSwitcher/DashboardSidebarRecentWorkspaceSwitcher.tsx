import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import {
	type Ref,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { LuBot, LuFlag, LuGitBranch, LuListChecks } from "react-icons/lu";
import { usePresetIcon } from "renderer/assets/app-icons/preset-icons";
import {
	type AgentConversation,
	useAgentConversations,
} from "renderer/hooks/useAgentConversations";
import { useNow } from "renderer/hooks/useNow";
import { useHotkey } from "renderer/hotkeys";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { StatusIndicator } from "renderer/screens/main/components/StatusIndicator";
import {
	orderByRecency,
	useWorkspaceRecencyStore,
} from "renderer/stores/workspace-recency";
import type { ActivePaneStatus } from "shared/tabs-types";
import { useSidebarWorkspaceStatuses } from "../../providers/DashboardSidebarWorkspaceStatusProvider";
import type { ActiveWorkspaceSwitcherOption } from "../../utils/buildWorkspaceSwitcherOptions";
import { DOT_CLASS } from "../DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/DashboardSidebarConversationList";
import { isWaitingOnUser } from "../DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import { LABEL_PILL_CLASS } from "../WorkspaceLabels/labels";
import { summarizeAgents } from "./utils/summarizeAgents";

interface DashboardSidebarRecentWorkspaceSwitcherProps {
	workspaces: ActiveWorkspaceSwitcherOption[];
	activeWorkspaceId: string | null;
}

interface SwitcherSession {
	items: ActiveWorkspaceSwitcherOption[];
	index: number;
	/** A conversation of the selected workspace picked with ↓, if any. */
	conversationIndex: number | null;
	/** False when rebound to a chord without a modifier: Enter commits. */
	holdsModifier: boolean;
	returnFocusTo: HTMLElement | null;
}

const MAX_CONVERSATIONS = 6;

function holdsAnyModifier(e: KeyboardEvent): boolean {
	return e.metaKey || e.ctrlKey || e.altKey;
}

/**
 * Ctrl+Tab like a browser's tab switcher: holding Ctrl shows one card per
 * workspace, most recently used first, each Tab steps one card, and releasing
 * Ctrl opens the selected workspace as it was left, so a quick Ctrl+Tab flips
 * back to the previous one. The selected workspace's conversations show
 * below the cards; ↓ picks one to open instead.
 */
export function DashboardSidebarRecentWorkspaceSwitcher({
	workspaces,
	activeWorkspaceId,
}: DashboardSidebarRecentWorkspaceSwitcherProps) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const statuses = useSidebarWorkspaceStatuses();
	const recent = useWorkspaceRecencyStore((state) => state.recent);
	const touch = useWorkspaceRecencyStore((state) => state.touch);
	const conversations = useAgentConversations();
	// Minutes are the finest unit shown.
	const now = useNow(30_000).getTime();
	const [session, setSession] = useState<SwitcherSession | null>(null);
	const sessionRef = useRef<SwitcherSession | null>(null);
	const conversationsRef = useRef<AgentConversation[]>([]);
	conversationsRef.current = conversations;
	const conversationsByWorkspace = useMemo(() => {
		const byWorkspace = new Map<string, AgentConversation[]>();
		for (const conversation of conversations) {
			const list = byWorkspace.get(conversation.workspaceId);
			if (list) list.push(conversation);
			else byWorkspace.set(conversation.workspaceId, [conversation]);
		}
		return byWorkspace;
	}, [conversations]);

	useEffect(() => {
		if (activeWorkspaceId) touch(activeWorkspaceId);
	}, [activeWorkspaceId, touch]);

	const updateSession = useCallback((next: SwitcherSession | null) => {
		sessionRef.current = next;
		setSession(next);
	}, []);

	const open = (e: KeyboardEvent, backwards: boolean) => {
		if (sessionRef.current) return;
		const items = orderByRecency(workspaces, [
			...(activeWorkspaceId ? [activeWorkspaceId] : []),
			...recent,
		]);
		if (items.length === 0) return;
		updateSession({
			items,
			index: backwards ? items.length - 1 : Math.min(1, items.length - 1),
			conversationIndex: null,
			holdsModifier: holdsAnyModifier(e),
			returnFocusTo:
				document.activeElement instanceof HTMLElement
					? document.activeElement
					: null,
		});
	};
	const hotkeyOptions = {
		ignoreEventWhen: (e: KeyboardEvent) => e.defaultPrevented,
	};
	useHotkey("NEXT_RECENT_WORKSPACE", (e) => open(e, false), hotkeyOptions);
	useHotkey("PREV_RECENT_WORKSPACE", (e) => open(e, true), hotkeyOptions);

	useEffect(() => {
		const conversationsOf = (workspaceId: string | undefined) =>
			conversationsRef.current
				.filter((conversation) => conversation.workspaceId === workspaceId)
				.slice(0, MAX_CONVERSATIONS);

		const close = () => {
			const returnFocusTo = sessionRef.current?.returnFocusTo;
			updateSession(null);
			if (returnFocusTo?.isConnected) returnFocusTo.focus();
		};
		const commit = () => {
			const current = sessionRef.current;
			const workspace = current?.items[current.index];
			const conversation =
				current?.conversationIndex != null
					? conversationsOf(workspace?.id)[current.conversationIndex]
					: undefined;
			close();
			if (!workspace) return;
			if (conversation) {
				void navigateToV2Workspace(workspace.id, navigate, {
					search: {
						terminalId: conversation.terminalId,
						focusRequestId: crypto.randomUUID(),
					},
				});
			} else if (workspace.id !== activeWorkspaceId) {
				void navigateToV2Workspace(workspace.id, navigate);
			}
		};
		const stepWorkspace = (delta: number) => {
			const current = sessionRef.current;
			if (!current) return;
			const count = current.items.length;
			updateSession({
				...current,
				index: (current.index + delta + count) % count,
				conversationIndex: null,
			});
		};
		const stepConversation = (delta: number) => {
			const current = sessionRef.current;
			if (!current) return;
			const count = conversationsOf(current.items[current.index]?.id).length;
			if (count === 0) return;
			const next = (current.conversationIndex ?? -1) + delta;
			updateSession({
				...current,
				conversationIndex: next < 0 ? null : Math.min(next, count - 1),
			});
		};

		const onKeyDown = (e: KeyboardEvent) => {
			if (!sessionRef.current) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.key === "Tab") stepWorkspace(e.shiftKey ? -1 : 1);
			else if (e.key === "ArrowRight") stepWorkspace(1);
			else if (e.key === "ArrowLeft") stepWorkspace(-1);
			else if (e.key === "ArrowDown") stepConversation(1);
			else if (e.key === "ArrowUp") stepConversation(-1);
			else if (e.key === "Enter") commit();
			else if (e.key === "Escape") close();
		};
		const onKeyUp = (e: KeyboardEvent) => {
			const current = sessionRef.current;
			if (!current?.holdsModifier || holdsAnyModifier(e)) return;
			commit();
		};

		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("keyup", onKeyUp, true);
		window.addEventListener("blur", close);
		return () => {
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("keyup", onKeyUp, true);
			window.removeEventListener("blur", close);
		};
	}, [activeWorkspaceId, navigate, updateSession]);

	const optionIdPrefix = useId();
	const listboxRef = useRef<HTMLDivElement>(null);
	const selectedChipRef = useRef<HTMLDivElement>(null);
	const isOpen = session !== null;
	const selectedIndex = session?.index;
	useEffect(() => {
		if (isOpen) listboxRef.current?.focus();
	}, [isOpen]);
	useEffect(() => {
		if (selectedIndex === undefined) return;
		selectedChipRef.current?.scrollIntoView({
			block: "nearest",
			inline: "nearest",
		});
	}, [selectedIndex]);

	if (!session) return null;

	const selected = session.items[session.index];
	const selectedConversations =
		conversationsByWorkspace.get(selected?.id ?? "") ?? [];
	const hiddenCount = selectedConversations.length - MAX_CONVERSATIONS;

	const openWorkspace = (item: ActiveWorkspaceSwitcherOption) => {
		updateSession(null);
		if (item.id !== activeWorkspaceId) {
			void navigateToV2Workspace(item.id, navigate);
		}
	};

	return createPortal(
		<div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 px-4">
			<div
				ref={listboxRef}
				role="listbox"
				tabIndex={-1}
				aria-orientation="horizontal"
				aria-activedescendant={`${optionIdPrefix}-${session.index}`}
				aria-label={t({ message: "Switch to Recent Workspace" })}
				className="pointer-events-auto flex max-w-full gap-2.5 overflow-x-auto rounded-2xl border bg-popover/95 p-2.5 text-popover-foreground shadow-2xl outline-none ring-1 ring-black/20 backdrop-blur [scrollbar-width:none]"
			>
				{session.items.map((item, index) => (
					<WorkspaceCard
						key={item.id}
						ref={index === session.index ? selectedChipRef : undefined}
						id={`${optionIdPrefix}-${index}`}
						item={item}
						status={statuses.get(item.id)?.status ?? null}
						conversations={conversationsByWorkspace.get(item.id) ?? []}
						isSelected={index === session.index}
						isCurrent={item.id === activeWorkspaceId}
						onMouseEnter={() =>
							updateSession({ ...session, index, conversationIndex: null })
						}
						onMouseDown={() => openWorkspace(item)}
					/>
				))}
			</div>
			{selected && (
				<div className="pointer-events-auto w-[480px] max-w-full rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl">
					{selectedConversations.length === 0 ? (
						<div className="px-2 py-1 text-xs text-muted-foreground">
							{t({ message: "No agent conversations" })}
						</div>
					) : (
						selectedConversations
							.slice(0, MAX_CONVERSATIONS)
							.map((conversation, index) => (
								<SwitcherConversationRow
									key={conversation.terminalId}
									conversation={conversation}
									openTodos={
										selected.todos.byTerminal[conversation.terminalId] ?? 0
									}
									now={now}
									isSelected={index === session.conversationIndex}
									onMouseEnter={() =>
										updateSession({ ...session, conversationIndex: index })
									}
									onMouseDown={() => {
										updateSession(null);
										void navigateToV2Workspace(selected.id, navigate, {
											search: {
												terminalId: conversation.terminalId,
												focusRequestId: crypto.randomUUID(),
											},
										});
									}}
								/>
							))
					)}
					{hiddenCount > 0 && (
						<div className="px-2 pt-0.5 text-[11px] text-muted-foreground">
							{t({ message: `+${hiddenCount} more` })}
						</div>
					)}
					<div className="mt-1 border-t px-2 pt-1.5 pb-0.5 text-[11px] text-muted-foreground">
						{t({
							message:
								"Tab: next workspace · ↑↓: pick a conversation · release Ctrl to open",
						})}
					</div>
				</div>
			)}
		</div>,
		document.body,
	);
}

const MAX_CARD_AGENTS = 6;

const PR_STATE_CLASS: Record<
	NonNullable<ActiveWorkspaceSwitcherOption["pullRequest"]>["state"],
	string
> = {
	open: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	draft: "bg-muted text-muted-foreground",
	merged: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
	closed: "bg-red-500/15 text-red-600 dark:text-red-400",
	queued: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function WorkspaceCard({
	ref,
	id,
	item,
	status,
	conversations,
	isSelected,
	isCurrent,
	onMouseEnter,
	onMouseDown,
}: {
	ref?: Ref<HTMLDivElement>;
	id: string;
	item: ActiveWorkspaceSwitcherOption;
	status: ActivePaneStatus | null;
	conversations: AgentConversation[];
	isSelected: boolean;
	isCurrent: boolean;
	onMouseEnter: () => void;
	onMouseDown: () => void;
}) {
	const { t } = useLingui();
	const extraAgents = conversations.length - MAX_CARD_AGENTS;
	const groupColor = item.section?.color ?? item.project?.color ?? null;
	const { pullRequest, todos } = item;
	return (
		<div
			ref={ref}
			id={id}
			role="option"
			tabIndex={-1}
			aria-selected={isSelected}
			className={cn(
				"flex min-h-[132px] w-60 shrink-0 cursor-default flex-col gap-1.5 rounded-xl border border-l-4 border-border/60 bg-muted/40 py-2.5 pr-3 pl-2.5 text-left transition-colors",
				isSelected &&
					"border-ring bg-accent text-accent-foreground shadow-md ring-1 ring-ring",
			)}
			style={groupColor ? { borderLeftColor: groupColor } : undefined}
			onMouseEnter={onMouseEnter}
			onMouseDown={(e) => {
				e.preventDefault();
				onMouseDown();
			}}
		>
			<div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
				{(item.project || item.section) && (
					<>
						<span
							className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
							style={groupColor ? { backgroundColor: groupColor } : undefined}
						/>
						<span className="truncate font-medium">
							{item.project && item.section
								? `${item.project.name} › ${item.section.name}`
								: (item.section ?? item.project)?.name}
						</span>
					</>
				)}
				{isCurrent && (
					<span className="ml-auto shrink-0 rounded bg-foreground/10 px-1 text-[10px] text-foreground/80">
						{t({ message: "Current" })}
					</span>
				)}
			</div>
			<div className="flex min-w-0 items-start gap-1.5">
				{status && <StatusIndicator status={status} className="mt-1.5" />}
				<span className="line-clamp-2 break-words font-semibold text-[15px] leading-snug">
					{item.name}
				</span>
			</div>
			{(item.branch || pullRequest) && (
				<div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
					{item.branch && (
						<>
							<LuGitBranch className="size-3 shrink-0" />
							<span className="min-w-0 truncate font-mono">{item.branch}</span>
						</>
					)}
					{pullRequest && (
						<span
							className={cn(
								"ml-auto shrink-0 rounded px-1 font-medium text-[10px] leading-4",
								PR_STATE_CLASS[pullRequest.state],
							)}
						>
							#{pullRequest.number}
						</span>
					)}
				</div>
			)}
			{item.labels.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{item.labels.map((label) => (
						<span
							key={label.id}
							className={cn(
								"max-w-full truncate rounded px-1.5 font-medium text-[11px] leading-[18px]",
								LABEL_PILL_CLASS[label.color],
							)}
						>
							{label.name}
						</span>
					))}
				</div>
			)}
			<div className="mt-auto flex min-w-0 items-center gap-2 pt-0.5">
				<AgentStateLine conversations={conversations} />
				{todos.open > 0 && (
					<span
						className={cn(
							"ml-auto flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums",
							todos.highPriority > 0
								? "font-medium text-red-600 dark:text-red-400"
								: "text-muted-foreground",
						)}
						title={
							todos.highPriority > 0
								? t({
										message: plural(todos.highPriority, {
											one: "# high-priority to-do",
											other: "# high-priority to-dos",
										}),
									})
								: undefined
						}
					>
						{todos.highPriority > 0 ? (
							<LuFlag className="size-3" />
						) : (
							<LuListChecks className="size-3" />
						)}
						{todos.open}
					</span>
				)}
			</div>
			{conversations.length > 0 && (
				<div className="flex items-center gap-1.5">
					{conversations.slice(0, MAX_CARD_AGENTS).map((conversation) => (
						<AgentAvatar
							key={conversation.terminalId}
							conversation={conversation}
						/>
					))}
					{extraAgents > 0 && (
						<span className="text-[10px] text-muted-foreground">
							+{extraAgents}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

/** "2 agents need you · 1 working": the states that ask something first. */
function AgentStateLine({
	conversations,
}: {
	conversations: AgentConversation[];
}) {
	const { t } = useLingui();
	const summary = summarizeAgents(conversations);
	const parts: { key: string; dot: string; text: string; strong: boolean }[] =
		[];
	if (summary.needsYou > 0) {
		parts.push({
			key: "needsYou",
			dot: DOT_CLASS.request,
			text: t({
				message: plural(summary.needsYou, {
					one: "# agent needs you",
					other: "# agents need you",
				}),
			}),
			strong: true,
		});
	}
	if (summary.working > 0) {
		parts.push({
			key: "working",
			dot: DOT_CLASS.working,
			text: t({ message: `${summary.working} working` }),
			strong: parts.length === 0,
		});
	}
	if (summary.done > 0) {
		parts.push({
			key: "done",
			dot: summary.unseen > 0 ? DOT_CLASS.unseen : DOT_CLASS.seen,
			text: t({ message: `${summary.done} done` }),
			strong: parts.length === 0 && summary.unseen > 0,
		});
	}
	if (parts.length === 0) {
		return (
			<span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
				<span className={cn("size-2 rounded-full", DOT_CLASS.idle)} />
				{conversations.length === 0
					? t({ message: "No agents" })
					: t({ message: "Idle" })}
			</span>
		);
	}
	return (
		<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
			{parts.map((part) => (
				<span
					key={part.key}
					className={cn(
						"flex items-center gap-1",
						part.strong
							? "font-medium text-foreground"
							: "text-muted-foreground",
					)}
				>
					<span className={cn("size-2 shrink-0 rounded-full", part.dot)} />
					{part.text}
				</span>
			))}
		</span>
	);
}

function AgentAvatar({ conversation }: { conversation: AgentConversation }) {
	const iconUrl = usePresetIcon(conversation.agentId);
	return (
		<span className="relative flex size-3.5 shrink-0 items-center justify-center">
			{iconUrl ? (
				<img src={iconUrl} alt="" className="size-3.5 object-contain" />
			) : (
				<LuBot className="size-3.5" />
			)}
			<span
				className={cn(
					"absolute -right-1 -bottom-0.5 size-2 rounded-full ring-2 ring-popover",
					DOT_CLASS[conversation.state],
				)}
			/>
		</span>
	);
}

function SwitcherConversationRow({
	conversation,
	openTodos,
	now,
	isSelected,
	onMouseEnter,
	onMouseDown,
}: {
	conversation: AgentConversation;
	openTodos: number;
	now: number;
	isSelected: boolean;
	onMouseEnter: () => void;
	onMouseDown: () => void;
}) {
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: keyboard goes through the switcher's window listener
		<div
			className={cn(
				"flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-[13px]",
				isSelected && "bg-accent text-accent-foreground",
			)}
			onMouseEnter={onMouseEnter}
			onMouseDown={(e) => {
				e.preventDefault();
				onMouseDown();
			}}
		>
			<AgentAvatar conversation={conversation} />
			<span className="min-w-0 flex-1 truncate">{conversation.title}</span>
			{openTodos > 0 && (
				<span className="flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums text-muted-foreground">
					<LuListChecks className="size-3" />
					{openTodos}
				</span>
			)}
			{isWaitingOnUser(conversation.state) && (
				<span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
					{formatCompactRelativeTime(Math.min(conversation.since, now), now)}
				</span>
			)}
		</div>
	);
}
