import { Plural, useLingui } from "@lingui/react/macro";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { AgentStateDot } from "renderer/components/AgentStateDot";
import {
	hostConversationTodosQueryOptions,
	hostKeepsTodos,
} from "renderer/hooks/host-service/useHostConversationTodos";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useV2NotificationStore } from "renderer/stores/v2-notifications";
import {
	type SidebarStatusWorkspaceRef,
	useSidebarWorkspaceStatuses,
} from "../../providers/DashboardSidebarWorkspaceStatusProvider";
import { nextNeedsYouTarget, summarizeNeedsYou } from "./needsYou";

/**
 * What waits on the user across every workspace: agents blocked on a
 * question, a permission or an error, and open high-priority to-dos. Each
 * click opens the next one. Hidden when nothing waits.
 */
export function DashboardSidebarNeedsYouRow({
	workspaces,
}: {
	workspaces: SidebarStatusWorkspaceRef[];
}) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const statuses = useSidebarWorkspaceStatuses();
	const terminalSeenAt = useV2NotificationStore(
		(state) => state.terminalSeenAt,
	);
	const { cache } = useHostWorkspaces();
	const hostUrls = useMemo(() => {
		const urls = new Set<string>();
		for (const workspace of workspaces) {
			if (cache.isSandboxHost(workspace.hostId)) continue;
			const url = cache.resolveHostUrl(workspace.hostId);
			if (url && hostKeepsTodos(url)) urls.add(url);
		}
		return [...urls].sort();
	}, [workspaces, cache]);
	// The same per-host reads as the rows' to-dos: no extra request.
	const todoLists = useQueries({
		queries: hostUrls.map((url) => hostConversationTodosQueryOptions(url)),
		combine: (results) => results.map((result) => result.data ?? null),
	});

	const summary = useMemo(
		() =>
			summarizeNeedsYou({
				workspaces: workspaces.map((workspace) => ({
					id: workspace.id,
					bindings: statuses.get(workspace.id)?.bindings.values() ?? [],
				})),
				terminalSeenAt,
				todos: todoLists.flatMap((list) => list ?? []),
			}),
		[workspaces, statuses, terminalSeenAt, todoLists],
	);
	const lastOpened = useRef<string | null>(null);

	const total = summary.agents + summary.todos;
	if (total === 0) return null;

	const openNext = () => {
		const target = nextNeedsYouTarget(summary.targets, lastOpened.current);
		if (!target) return;
		lastOpened.current = target.terminalId;
		void navigateToV2Workspace(target.workspaceId, navigate, {
			search: {
				terminalId: target.terminalId,
				focusRequestId: crypto.randomUUID(),
			},
		});
	};

	const agents = summary.agents;
	const todos = summary.todos;

	return (
		<div className="px-2 pt-1 pb-1">
			<button
				type="button"
				onClick={openNext}
				title={t`Open the next conversation that needs you`}
				className="group flex h-[var(--sb-row-h)] w-full items-center gap-2 rounded-md bg-[color-mix(in_oklab,var(--sb-state-needsYou)_10%,transparent)] px-2 text-[13px] font-medium text-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--sb-state-needsYou)_18%,transparent)]"
			>
				<span className="flex size-4 shrink-0 items-center justify-center">
					<AgentStateDot state="needsYou" />
				</span>
				<span className="shrink-0">{t`Needs you`}</span>
				<span className="min-w-0 flex-1 truncate text-left text-[11px] font-normal text-muted-foreground">
					{agents > 0 && (
						<Plural value={agents} one="# agent" other="# agents" />
					)}
					{agents > 0 && todos > 0 && " · "}
					{todos > 0 && <Plural value={todos} one="# to-do" other="# to-dos" />}
				</span>
				<span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[var(--sb-state-needsYou)] px-1 text-[10px] font-semibold tabular-nums text-black">
					{total > 99 ? "99+" : total}
				</span>
			</button>
		</div>
	);
}
