import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
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
import type { WorkspaceLabel } from "../WorkspaceLabels";
import { LABEL_PILL_CLASS } from "../WorkspaceLabels/labels";
import { slideCardWindow } from "./utils/cardWindow";
import { summarizeAgents } from "./utils/summarizeAgents";

interface DashboardSidebarRecentWorkspaceSwitcherProps {
	workspaces: ActiveWorkspaceSwitcherOption[];
	activeWorkspaceId: string | null;
}

interface SwitcherSession {
	items: ActiveWorkspaceSwitcherOption[];
	index: number;
	/** First card shown when they don't all fit the window. */
	windowStart: number;
	/** False when rebound to a chord without a modifier: Enter commits. */
	holdsModifier: boolean;
	returnFocusTo: HTMLElement | null;
}

function holdsAnyModifier(e: KeyboardEvent): boolean {
	return e.metaKey || e.ctrlKey || e.altKey;
}

function useViewportWidth(enabled: boolean): number {
	const [width, setWidth] = useState(() => window.innerWidth);
	useEffect(() => {
		if (!enabled) return;
		const update = () => setWidth(window.innerWidth);
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, [enabled]);
	return width;
}

/**
 * Ctrl+Tab like a browser's tab switcher: holding Ctrl shows one card per
 * workspace, most recently used first, each Tab steps one card, and releasing
 * Ctrl opens the selected workspace as it was left, so a quick Ctrl+Tab flips
 * back to the previous one. When the cards don't fit the window, a window of
 * them follows the selection, with "+N" at the ends.
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
	const [session, setSession] = useState<SwitcherSession | null>(null);
	const sessionRef = useRef<SwitcherSession | null>(null);
	const viewportWidth = useViewportWidth(session !== null);
	const viewportWidthRef = useRef(viewportWidth);
	viewportWidthRef.current = viewportWidth;
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

	/** Selects `index`, sliding the shown cards only if it left them. */
	const select = useCallback(
		(current: SwitcherSession, index: number) => {
			updateSession({
				...current,
				index,
				windowStart: slideCardWindow({
					previousStart: current.windowStart,
					index,
					count: current.items.length,
					viewportWidth: viewportWidthRef.current,
				}).start,
			});
		},
		[updateSession],
	);

	const open = (e: KeyboardEvent, backwards: boolean) => {
		if (sessionRef.current) return;
		const items = orderByRecency(workspaces, [
			...(activeWorkspaceId ? [activeWorkspaceId] : []),
			...recent,
		]);
		if (items.length === 0) return;
		select(
			{
				items,
				index: 0,
				windowStart: 0,
				holdsModifier: holdsAnyModifier(e),
				returnFocusTo:
					document.activeElement instanceof HTMLElement
						? document.activeElement
						: null,
			},
			backwards ? items.length - 1 : Math.min(1, items.length - 1),
		);
	};
	const hotkeyOptions = {
		ignoreEventWhen: (e: KeyboardEvent) => e.defaultPrevented,
	};
	useHotkey("NEXT_RECENT_WORKSPACE", (e) => open(e, false), hotkeyOptions);
	useHotkey("PREV_RECENT_WORKSPACE", (e) => open(e, true), hotkeyOptions);

	useEffect(() => {
		const close = () => {
			const returnFocusTo = sessionRef.current?.returnFocusTo;
			updateSession(null);
			if (returnFocusTo?.isConnected) returnFocusTo.focus();
		};
		const commit = () => {
			const current = sessionRef.current;
			const workspace = current?.items[current.index];
			close();
			if (workspace && workspace.id !== activeWorkspaceId) {
				void navigateToV2Workspace(workspace.id, navigate);
			}
		};
		const stepWorkspace = (delta: number) => {
			const current = sessionRef.current;
			if (!current) return;
			const count = current.items.length;
			select(current, (current.index + delta + count) % count);
		};

		const onKeyDown = (e: KeyboardEvent) => {
			if (!sessionRef.current) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.key === "Tab") stepWorkspace(e.shiftKey ? -1 : 1);
			else if (e.key === "ArrowRight") stepWorkspace(1);
			else if (e.key === "ArrowLeft") stepWorkspace(-1);
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
	}, [activeWorkspaceId, navigate, updateSession, select]);

	const optionIdPrefix = useId();
	const listboxRef = useRef<HTMLDivElement>(null);
	const isOpen = session !== null;
	useEffect(() => {
		if (isOpen) listboxRef.current?.focus();
	}, [isOpen]);

	if (!session) return null;

	// Re-derived on each render so a resized window re-fits the strip.
	const shown = slideCardWindow({
		previousStart: session.windowStart,
		index: session.index,
		count: session.items.length,
		viewportWidth,
	});
	const hiddenBefore = shown.start;
	const hiddenAfter = session.items.length - shown.start - shown.size;
	const isWindowed = shown.size < session.items.length;

	const openWorkspace = (item: ActiveWorkspaceSwitcherOption) => {
		updateSession(null);
		if (item.id !== activeWorkspaceId) {
			void navigateToV2Workspace(item.id, navigate);
		}
	};

	return createPortal(
		<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
			<div
				ref={listboxRef}
				role="listbox"
				tabIndex={-1}
				aria-orientation="horizontal"
				aria-activedescendant={`${optionIdPrefix}-${session.index}`}
				aria-label={t({ message: "Switch to Recent Workspace" })}
				className="pointer-events-auto flex max-w-full items-stretch gap-2.5 rounded-2xl border bg-popover/95 p-2.5 text-popover-foreground shadow-2xl outline-none ring-1 ring-black/20 backdrop-blur"
			>
				{isWindowed && <MoreHint count={hiddenBefore} />}
				{session.items
					.slice(shown.start, shown.start + shown.size)
					.map((item, offset) => {
						const index = shown.start + offset;
						return (
							<WorkspaceCard
								key={item.id}
								id={`${optionIdPrefix}-${index}`}
								item={item}
								status={statuses.get(item.id)?.status ?? null}
								conversations={conversationsByWorkspace.get(item.id) ?? []}
								isSelected={index === session.index}
								isCurrent={item.id === activeWorkspaceId}
								onMouseEnter={() => select(session, index)}
								onMouseDown={() => openWorkspace(item)}
							/>
						);
					})}
				{isWindowed && <MoreHint count={hiddenAfter} />}
			</div>
		</div>,
		document.body,
	);
}

/** A fixed-width end of a windowed strip; empty when nothing is hidden there. */
function MoreHint({ count }: { count: number }) {
	return (
		<div className="flex w-8 shrink-0 items-center justify-center text-[12px] tabular-nums text-muted-foreground">
			{count > 0 ? `+${count}` : null}
		</div>
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
	id,
	item,
	status,
	conversations,
	isSelected,
	isCurrent,
	onMouseEnter,
	onMouseDown,
}: {
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
			id={id}
			role="option"
			tabIndex={-1}
			aria-selected={isSelected}
			className={cn(
				"flex h-[176px] w-60 min-w-44 shrink cursor-default flex-col gap-1.5 overflow-hidden rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 text-left transition-colors",
				isSelected &&
					"border-ring bg-accent text-accent-foreground shadow-md ring-1 ring-ring",
			)}
			onMouseEnter={onMouseEnter}
			onMouseDown={(e) => {
				e.preventDefault();
				onMouseDown();
			}}
		>
			<div className="flex h-4 min-w-0 shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
				{(item.project || item.section) && (
					<>
						<span
							className="size-2 shrink-0 rounded-[3px] bg-muted-foreground/40"
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
			<div className="flex h-[42px] min-w-0 shrink-0 items-start gap-1.5">
				{status && <StatusIndicator status={status} className="mt-2" />}
				<span className="line-clamp-2 break-words font-semibold text-[15px] leading-[21px]">
					{item.name}
				</span>
			</div>
			<div className="flex h-4 min-w-0 shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
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
			<LabelRow labels={item.labels} />
			<div className="mt-auto flex h-4 min-w-0 shrink-0 items-center gap-2">
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
			<div className="flex h-4 shrink-0 items-center gap-1.5">
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
		</div>
	);
}

/** Room kept for the "+N" after the labels that fit. */
const MORE_LABELS_WIDTH = 28;

/**
 * The labels on one line: those that fit, then "+N". Every pill stays laid
 * out (the clipped ones invisible) so their widths can be measured.
 */
function LabelRow({ labels }: { labels: WorkspaceLabel[] }) {
	const rowRef = useRef<HTMLDivElement>(null);
	const pillsRef = useRef<HTMLDivElement>(null);
	const [fitting, setFitting] = useState(labels.length);

	// biome-ignore lint/correctness/useExhaustiveDependencies: new labels need a new measure
	useLayoutEffect(() => {
		const row = rowRef.current;
		const pills = pillsRef.current;
		if (!row || !pills) return;
		const measure = () => {
			const rights = [...pills.children].map(
				(pill) =>
					(pill as HTMLElement).offsetLeft + (pill as HTMLElement).offsetWidth,
			);
			const width = row.clientWidth;
			const all = rights.length === 0 || (rights.at(-1) ?? 0) <= width;
			const fit = all
				? rights.length
				: rights.filter((right) => right <= width - MORE_LABELS_WIDTH).length;
			setFitting(Math.max(1, fit));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(row);
		return () => observer.disconnect();
	}, [labels]);

	const hidden = labels.length - Math.min(fitting, labels.length);
	return (
		<div
			ref={rowRef}
			className="flex h-[18px] min-w-0 shrink-0 items-center gap-1"
			title={labels.map((label) => label.name).join(", ")}
		>
			<div
				ref={pillsRef}
				className="relative flex min-w-0 flex-1 gap-1 overflow-hidden"
			>
				{labels.map((label, index) => (
					<span
						key={label.id}
						className={cn(
							"max-w-32 shrink-0 truncate rounded px-1.5 font-medium text-[11px] leading-[18px]",
							LABEL_PILL_CLASS[label.color],
							index >= fitting && "invisible",
						)}
					>
						{label.name}
					</span>
				))}
			</div>
			{hidden > 0 && (
				<span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
					+{hidden}
				</span>
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
		<span className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[12px]">
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
