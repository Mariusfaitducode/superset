import { useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuBot } from "react-icons/lu";
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
import { useSidebarWorkspaceStatuses } from "../../providers/DashboardSidebarWorkspaceStatusProvider";
import type { ActiveWorkspaceSwitcherOption } from "../DashboardSidebarActiveWorkspaceSwitcher";
import { DOT_CLASS } from "../DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/DashboardSidebarConversationList";
import { isWaitingOnUser } from "../DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";

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
 * Ctrl+Tab like a browser's tab switcher: holding Ctrl lists workspaces most
 * recently used first, each Tab steps one, releasing Ctrl opens the selected
 * one, so a quick Ctrl+Tab flips back to the previous workspace. The selected
 * workspace's conversations show below; ↓ picks one to open instead.
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
	const selectedConversations = conversations.filter(
		(conversation) => conversation.workspaceId === selected?.id,
	);
	const hiddenCount = selectedConversations.length - MAX_CONVERSATIONS;

	const openWorkspace = (item: ActiveWorkspaceSwitcherOption) => {
		updateSession(null);
		if (item.id !== activeWorkspaceId) {
			void navigateToV2Workspace(item.id, navigate);
		}
	};

	return createPortal(
		<div className="pointer-events-none fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-1.5">
			<div
				ref={listboxRef}
				role="listbox"
				tabIndex={-1}
				aria-orientation="horizontal"
				aria-activedescendant={`${optionIdPrefix}-${session.index}`}
				aria-label={t({ message: "Switch to Recent Workspace" })}
				className="pointer-events-auto flex max-w-[90vw] items-center gap-1 overflow-x-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-2xl outline-none ring-1 ring-black/20 [scrollbar-width:none]"
			>
				{session.items.map((item, index) => {
					const status = statuses.get(item.id)?.status;
					return (
						<div
							key={item.id}
							ref={index === session.index ? selectedChipRef : undefined}
							id={`${optionIdPrefix}-${index}`}
							role="option"
							tabIndex={-1}
							aria-selected={index === session.index}
							className={cn(
								"flex h-8 max-w-56 shrink-0 cursor-default items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground",
								index === session.index &&
									"bg-accent text-accent-foreground ring-1 ring-border",
							)}
							onMouseEnter={() =>
								updateSession({ ...session, index, conversationIndex: null })
							}
							onMouseDown={(e) => {
								e.preventDefault();
								openWorkspace(item);
							}}
						>
							{status && <StatusIndicator status={status} />}
							<span className="truncate">{item.name}</span>
						</div>
					);
				})}
			</div>
			{selected && (
				<div className="pointer-events-auto w-[400px] max-w-[90vw] rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl">
					<div className="truncate px-2 pt-0.5 pb-1 text-[11px] text-muted-foreground">
						{selected.detail
							? `${selected.detail} › ${selected.name}`
							: selected.name}
					</div>
					{selectedConversations.length === 0 ? (
						<div className="px-2 pb-1 text-xs text-muted-foreground">
							{t({ message: "No agent conversations" })}
						</div>
					) : (
						selectedConversations
							.slice(0, MAX_CONVERSATIONS)
							.map((conversation, index) => (
								<SwitcherConversationRow
									key={conversation.terminalId}
									conversation={conversation}
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
				</div>
			)}
		</div>,
		document.body,
	);
}

function SwitcherConversationRow({
	conversation,
	now,
	isSelected,
	onMouseEnter,
	onMouseDown,
}: {
	conversation: AgentConversation;
	now: number;
	isSelected: boolean;
	onMouseEnter: () => void;
	onMouseDown: () => void;
}) {
	const iconUrl = usePresetIcon(conversation.agentId);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: keyboard goes through the switcher's window listener
		<div
			className={cn(
				"flex h-7 cursor-default items-center gap-2 rounded-md px-2 text-[12px]",
				isSelected && "bg-accent text-accent-foreground",
			)}
			onMouseEnter={onMouseEnter}
			onMouseDown={(e) => {
				e.preventDefault();
				onMouseDown();
			}}
		>
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
			<span className="min-w-0 flex-1 truncate">{conversation.title}</span>
			{isWaitingOnUser(conversation.state) && (
				<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
					{formatCompactRelativeTime(Math.min(conversation.since, now), now)}
				</span>
			)}
		</div>
	);
}
