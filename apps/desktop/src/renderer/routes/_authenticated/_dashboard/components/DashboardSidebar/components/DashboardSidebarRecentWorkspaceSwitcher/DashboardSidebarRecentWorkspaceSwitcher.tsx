import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHotkey } from "renderer/hotkeys";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { StatusIndicator } from "renderer/screens/main/components/StatusIndicator";
import {
	orderByRecency,
	useWorkspaceRecencyStore,
} from "renderer/stores/workspace-recency";
import { useSidebarWorkspaceStatuses } from "../../providers/DashboardSidebarWorkspaceStatusProvider";
import type { ActiveWorkspaceSwitcherOption } from "../DashboardSidebarActiveWorkspaceSwitcher";

interface DashboardSidebarRecentWorkspaceSwitcherProps {
	workspaces: ActiveWorkspaceSwitcherOption[];
	activeWorkspaceId: string | null;
}

interface SwitcherSession {
	items: ActiveWorkspaceSwitcherOption[];
	index: number;
	/** False when rebound to a chord without a modifier: Enter commits. */
	holdsModifier: boolean;
	returnFocusTo: HTMLElement | null;
}

function holdsAnyModifier(e: KeyboardEvent): boolean {
	return e.metaKey || e.ctrlKey || e.altKey;
}

/**
 * Ctrl+Tab like a browser's tab switcher: holding Ctrl lists workspaces most
 * recently used first, each Tab steps one row, releasing Ctrl opens the
 * selected one. A quick Ctrl+Tab therefore flips back to the previous one.
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
	const [session, setSession] = useState<SwitcherSession | null>(null);
	const sessionRef = useRef<SwitcherSession | null>(null);

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
		const close = () => {
			const returnFocusTo = sessionRef.current?.returnFocusTo;
			updateSession(null);
			if (returnFocusTo?.isConnected) returnFocusTo.focus();
		};
		const commit = () => {
			const target = sessionRef.current?.items[sessionRef.current.index];
			close();
			if (target && target.id !== activeWorkspaceId) {
				void navigateToV2Workspace(target.id, navigate);
			}
		};
		const step = (delta: number) => {
			const current = sessionRef.current;
			if (!current) return;
			const count = current.items.length;
			updateSession({
				...current,
				index: (current.index + delta + count) % count,
			});
		};

		const onKeyDown = (e: KeyboardEvent) => {
			if (!sessionRef.current) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.key === "Tab") step(e.shiftKey ? -1 : 1);
			else if (e.key === "ArrowDown") step(1);
			else if (e.key === "ArrowUp") step(-1);
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
	const selectedRowRef = useRef<HTMLDivElement>(null);
	const isOpen = session !== null;
	const selectedIndex = session?.index;
	useEffect(() => {
		if (isOpen) listboxRef.current?.focus();
	}, [isOpen]);
	useEffect(() => {
		if (selectedIndex === undefined) return;
		selectedRowRef.current?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	if (!session) return null;

	return createPortal(
		<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
			<div
				ref={listboxRef}
				role="listbox"
				tabIndex={-1}
				aria-activedescendant={`${optionIdPrefix}-${session.index}`}
				aria-label={t({ message: "Switch to Recent Workspace" })}
				className="pointer-events-auto flex max-h-[60vh] w-[420px] max-w-[90vw] flex-col gap-0.5 overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-2xl outline-none ring-1 ring-black/20 [scrollbar-width:none]"
			>
				{session.items.map((item, index) => {
					const status = statuses.get(item.id)?.status;
					return (
						<div
							key={item.id}
							ref={index === session.index ? selectedRowRef : undefined}
							id={`${optionIdPrefix}-${index}`}
							role="option"
							tabIndex={-1}
							aria-selected={index === session.index}
							className={cn(
								"flex h-8 shrink-0 cursor-default items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground",
								index === session.index &&
									"bg-accent text-accent-foreground ring-1 ring-border",
							)}
							onMouseEnter={() => updateSession({ ...session, index })}
							onMouseDown={(e) => {
								e.preventDefault();
								updateSession(null);
								if (item.id !== activeWorkspaceId) {
									void navigateToV2Workspace(item.id, navigate);
								}
							}}
						>
							<span className="flex w-3 shrink-0 justify-center">
								{status && <StatusIndicator status={status} />}
							</span>
							<span className="min-w-0 flex-1 truncate">{item.name}</span>
							{item.detail && (
								<span className="max-w-40 shrink-0 truncate text-[11px] text-muted-foreground">
									{item.detail}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>,
		document.body,
	);
}
