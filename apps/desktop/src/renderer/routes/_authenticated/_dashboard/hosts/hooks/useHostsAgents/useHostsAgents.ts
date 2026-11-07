import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
	getTerminalAgentBindingsQueryKey,
	type TerminalAgentBinding,
} from "renderer/hooks/host-service/useTerminalAgentBindings";
import type { HostWorkspaceItem } from "renderer/hooks/host-workspaces/useHostWorkspaces";
import {
	type KnownHostRow,
	useKnownHosts,
} from "renderer/hooks/known-hosts/useKnownHosts";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import {
	type HostSummary,
	summarizeHosts,
} from "renderer/routes/_authenticated/_dashboard/utils/summarizeHosts";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";
import { useV2NotificationStore } from "renderer/stores/v2-notifications";
import { bindingPaneStatus } from "../../utils/groupHostAgents";

const NO_BINDINGS: TerminalAgentBinding[] = [];
/** Lifecycle events invalidate these keys while the sidebar shows the workspace; this catches the rest. */
const BINDINGS_REFETCH_MS = 15_000;
const TITLES_REFETCH_MS = 10_000;

export interface HostsAgents {
	hosts: KnownHostRow[];
	summaries: HostSummary[];
	settled: boolean;
	workspacesOf: (machineId: string) => HostWorkspaceItem[];
	bindingsOf: (workspaceId: string) => TerminalAgentBinding[];
	hostUrlOf: (machineId: string) => string | null;
	terminalSeenAt: Readonly<Record<string, number>>;
}

/**
 * Every host of the roster with its workspaces and their live agents. The
 * bindings ride the sidebar's query keys, so both read one cache.
 */
export function useHostsAgents(): HostsAgents {
	const { hosts, settled } = useKnownHosts();
	const { machineId: localMachineId } = useLocalHostService();
	const { workspaces, cache } = useHostWorkspaces();
	const terminalSeenAt = useV2NotificationStore(
		(state) => state.terminalSeenAt,
	);

	const workspacesByHost = useMemo(() => {
		const rosterIds = new Set(hosts.map((host) => host.machineId));
		const byHost = new Map<string, HostWorkspaceItem[]>();
		for (const workspace of workspaces) {
			if (workspace.archivedAt != null || !rosterIds.has(workspace.hostId))
				continue;
			const list = byHost.get(workspace.hostId) ?? [];
			list.push(workspace);
			byHost.set(workspace.hostId, list);
		}
		for (const list of byHost.values()) {
			list.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));
		}
		return byHost;
	}, [hosts, workspaces]);

	const targets = useMemo(
		() =>
			[...workspacesByHost.entries()].flatMap(([machineId, list]) => {
				const hostUrl = cache.resolveHostUrl(machineId);
				return list.map((workspace) => ({
					workspaceId: workspace.id,
					hostId: machineId,
					hostUrl,
				}));
			}),
		[workspacesByHost, cache],
	);

	const bindingLists = useQueries({
		queries: targets.map(({ workspaceId, hostUrl }) => ({
			queryKey: getTerminalAgentBindingsQueryKey(workspaceId),
			enabled: hostUrl !== null,
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				hostUrl
					? getHostServiceClientByUrl(
							hostUrl,
						).terminalAgents.listByWorkspace.query({ workspaceId }, { signal })
					: NO_BINDINGS,
			staleTime: 30_000,
			refetchInterval: BINDINGS_REFETCH_MS,
		})),
		combine: (results) => results.map((result) => result.data ?? NO_BINDINGS),
	});

	const bindingsByWorkspace = useMemo(() => {
		const map = new Map<string, TerminalAgentBinding[]>();
		targets.forEach(({ workspaceId }, index) => {
			map.set(workspaceId, bindingLists[index] ?? NO_BINDINGS);
		});
		return map;
	}, [targets, bindingLists]);

	const summaries = useMemo(
		() =>
			summarizeHosts({
				hosts,
				localMachineId,
				workspaces: targets.map(({ workspaceId, hostId }) => ({
					id: workspaceId,
					hostId,
				})),
				agentStatuses: (workspaceId) =>
					(bindingsByWorkspace.get(workspaceId) ?? NO_BINDINGS)
						.filter((binding) => binding.endedAt == null)
						.map((binding) => bindingPaneStatus(binding, terminalSeenAt)),
			}).hosts,
		[hosts, localMachineId, targets, bindingsByWorkspace, terminalSeenAt],
	);

	return {
		hosts,
		summaries,
		settled,
		workspacesOf: (machineId) => workspacesByHost.get(machineId) ?? [],
		bindingsOf: (workspaceId) =>
			bindingsByWorkspace.get(workspaceId) ?? NO_BINDINGS,
		hostUrlOf: (machineId) => cache.resolveHostUrl(machineId),
		terminalSeenAt,
	};
}

/** `terminalId → title` for a host's live terminals. */
export function useHostTerminalTitles(
	hostUrl: string | null,
): ReadonlyMap<string, string> {
	const { data } = useQuery({
		queryKey: ["hosts-page", "terminal-titles", hostUrl],
		enabled: hostUrl !== null,
		queryFn: async ({ signal }) => {
			if (!hostUrl) return [];
			const { sessions } = await getHostServiceClientByUrl(
				hostUrl,
			).terminal.list.query(undefined, { signal });
			return sessions;
		},
		refetchInterval: TITLES_REFETCH_MS,
	});
	return useMemo(() => {
		const map = new Map<string, string>();
		for (const session of data ?? []) {
			if (session.title) map.set(session.terminalId, session.title);
		}
		return map;
	}, [data]);
}
