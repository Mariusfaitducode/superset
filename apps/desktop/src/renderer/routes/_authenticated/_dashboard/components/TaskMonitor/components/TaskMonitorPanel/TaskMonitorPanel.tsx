import { useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuX } from "react-icons/lu";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { hostTerminalTitlesQuery } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/hostTerminalTitles";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import {
	hostTrackedTasksQueryKey,
	useTrackedTasks,
} from "../../hooks/useTrackedTasks";
import { useTaskMonitorStore } from "../../stores/task-monitor";
import { type MonitoredTask, sortTasks } from "../../utils/task-monitor";
import { TaskCard } from "./components/TaskCard";

function useNow(intervalMs: number, enabled: boolean): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!enabled) return;
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(timer);
	}, [intervalMs, enabled]);
	return now;
}

/** Conversation titles of the hosts with tasks, read only while open. */
function useTitles(hostUrls: string[], enabled: boolean) {
	const results = useQueries({
		queries: hostUrls.map((url) => ({
			...hostTerminalTitlesQuery(url),
			enabled,
		})),
		combine: (entries) => entries.map((entry) => entry.data),
	});
	return useMemo(() => {
		const titles = new Map<string, string>();
		for (const map of results) {
			for (const [terminalId, title] of map ?? []) {
				const text = title.customTitle ?? title.runtimeTitle;
				if (text) titles.set(terminalId, text);
			}
		}
		return titles;
	}, [results]);
}

/**
 * Slides in from the right over the whole window height, like macOS's
 * notification center: every tracked task of every workspace, running ones
 * first. Escape or a click outside closes it.
 */
export function TaskMonitorPanel() {
	const { t } = useLingui();
	const isOpen = useTaskMonitorStore((state) => state.isOpen);
	const setOpen = useTaskMonitorStore((state) => state.setOpen);
	const [view, setView] = useState<"active" | "archived">("active");
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { workspaces } = useHostWorkspaces();
	const panelRef = useRef<HTMLDivElement>(null);

	const active = useTrackedTasks();
	const archived = useTrackedTasks({
		archived: true,
		enabled: isOpen && view === "archived",
	});
	const shown = view === "active" ? active.tasks : archived.tasks;
	const tasks = useMemo(
		() =>
			view === "active"
				? sortTasks(shown)
				: [...shown].sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
		[shown, view],
	);
	const now = useNow(30_000, isOpen);
	const hostUrls = useMemo(
		() => [...new Set(tasks.map((task) => task.hostUrl))].sort(),
		[tasks],
	);
	const titles = useTitles(hostUrls, isOpen);
	const workspaceNames = useMemo(
		() =>
			new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
		[workspaces],
	);

	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.stopPropagation();
			setOpen(false);
		};
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (panelRef.current?.contains(target)) return;
			if (target?.closest("[data-task-monitor-toggle]")) return;
			setOpen(false);
		};
		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("pointerdown", onPointerDown, true);
		return () => {
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("pointerdown", onPointerDown, true);
		};
	}, [isOpen, setOpen]);

	const act = async (
		task: MonitoredTask,
		action: "archive" | "restore",
	): Promise<void> => {
		try {
			await getHostServiceClientByUrl(task.hostUrl).trackedTasks[action].mutate(
				{ id: task.id },
			);
			await queryClient.invalidateQueries({
				queryKey: hostTrackedTasksQueryKey(task.hostUrl),
			});
		} catch (error) {
			toast.error(t`Could not update the task`, {
				description: error instanceof Error ? error.message : undefined,
			});
		}
	};

	const open = (task: MonitoredTask) => {
		setOpen(false);
		void navigateToV2Workspace(task.workspaceId, navigate, {
			search: {
				terminalId: task.liveTerminalId,
				focusRequestId: crypto.randomUUID(),
			},
		});
	};

	const running = active.tasks.filter(
		(task) => task.status === "running",
	).length;

	return (
		<div
			ref={panelRef}
			role="dialog"
			aria-label={t`Tracked tasks`}
			aria-hidden={!isOpen}
			inert={!isOpen}
			className={cn(
				"no-drag fixed inset-y-0 right-0 z-50 flex w-[380px] max-w-[calc(100vw-48px)] flex-col",
				"border-l border-border bg-background/95 shadow-2xl backdrop-blur-xl",
				"transition-transform duration-200 ease-out motion-reduce:transition-none",
				isOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
			)}
		>
			<header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4">
				<h2 className="text-sm font-semibold">{t`Tasks`}</h2>
				{running > 0 && (
					<span className="text-xs text-muted-foreground tabular-nums">
						{t`${running} running`}
					</span>
				)}
				<div className="ml-auto flex items-center rounded-md bg-muted/60 p-0.5 text-xs">
					{(
						[
							["active", t`Open`],
							["archived", t`Archived`],
						] as const
					).map(([value, label]) => (
						<button
							key={value}
							type="button"
							aria-pressed={view === value}
							onClick={() => setView(value)}
							className={cn(
								"rounded px-2 py-0.5 transition-colors",
								view === value
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{label}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => setOpen(false)}
					aria-label={t`Close`}
					className="-mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
				>
					<LuX className="size-4" />
				</button>
			</header>

			<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
				{tasks.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
						<p className="text-sm text-muted-foreground">
							{view === "active"
								? t`Nothing is being tracked`
								: t`No archived tasks`}
						</p>
						{view === "active" && (
							<p className="text-xs text-muted-foreground/70">
								{t`Agents add a card here with superset track when they wait on something long: a CI run, a build, a deploy.`}
							</p>
						)}
					</div>
				) : (
					tasks.map((task) => (
						<TaskCard
							key={`${task.hostUrl}:${task.id}`}
							task={task}
							workspaceName={workspaceNames.get(task.workspaceId) ?? null}
							conversationTitle={titles.get(task.liveTerminalId) ?? null}
							now={now}
							onOpen={() => open(task)}
							onArchive={
								view === "active" ? () => void act(task, "archive") : undefined
							}
							onRestore={
								view === "archived"
									? () => void act(task, "restore")
									: undefined
							}
						/>
					))
				)}
			</div>
		</div>
	);
}
