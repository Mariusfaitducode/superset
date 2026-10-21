import { useLiveQuery } from "@tanstack/react-db";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useHostProjects } from "renderer/hooks/host-projects/useHostProjects";
import type { TerminalAgentBinding } from "renderer/hooks/host-service/useTerminalAgentBindings";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { cleanTitle } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceConversations";
import { terminalTabNames } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/terminal-tab-names";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useV2NotificationStore } from "renderer/stores/v2-notifications";
import { getV2WorkspaceDisplayName } from "renderer/utils/getV2WorkspaceDisplayName";
import {
	buildSwitcherConversations,
	type SwitcherConversation,
	type SwitcherTitles,
	type SwitcherWorkspace,
} from "./switcher-conversations";

/**
 * The bindings the sidebar's status provider already keeps live for every
 * listed workspace, read from the query cache: the palette is mounted
 * outside that provider.
 */
function useCachedAgentBindings(): TerminalAgentBinding[] {
	const queryClient = useQueryClient();
	const [cacheVersion, setCacheVersion] = useState(0);

	useEffect(() => {
		return queryClient.getQueryCache().subscribe((event) => {
			// `added` fires during the render that builds a query.
			if (event.type !== "updated" && event.type !== "removed") return;
			if (event.query.queryKey[0] === "terminal-agent-bindings") {
				setCacheVersion((version) => version + 1);
			}
		});
	}, [queryClient]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: cacheVersion re-reads the query cache
	return useMemo(
		() =>
			queryClient
				.getQueriesData<TerminalAgentBinding[]>({
					queryKey: ["terminal-agent-bindings"],
				})
				.flatMap(([, bindings]) => bindings ?? []),
		[cacheVersion, queryClient],
	);
}

type TitleEntries = [string, SwitcherTitles][];

// Module-level so react-query can keep the combined result stable.
function titlesByHost(results: { data?: TitleEntries }[]) {
	return results.map((result) => result.data);
}

export function useSwitcherConversations(): SwitcherConversation[] {
	const bindings = useCachedAgentBindings();
	const terminalSeenAt = useV2NotificationStore(
		(state) => state.terminalSeenAt,
	);
	const { workspaces: hostWorkspaces, cache } = useHostWorkspaces();
	const { projects } = useHostProjects();

	const workspaces = useMemo(() => {
		const projectNames = new Map(
			projects.map((project) => [project.projectKey, project.name]),
		);
		return new Map(
			hostWorkspaces.map((workspace): [string, SwitcherWorkspace] => [
				workspace.id,
				{
					name: getV2WorkspaceDisplayName(workspace),
					projectName:
						workspace.projectId === null
							? null
							: (projectNames.get(workspace.projectId) ?? null),
				},
			]),
		);
	}, [hostWorkspaces, projects]);

	// One title read per host, not per workspace. Sandboxes are skipped as in
	// the sidebar: a request would keep their VM awake.
	const hostUrls = useMemo(() => {
		const workspaceIds = new Set(bindings.map((b) => b.workspaceId));
		const urls = new Set<string>();
		for (const workspace of hostWorkspaces) {
			if (!workspaceIds.has(workspace.id)) continue;
			if (cache.isSandboxHost(workspace.hostId)) continue;
			const url = cache.resolveHostUrl(workspace.hostId);
			if (url) urls.add(url);
		}
		return [...urls].sort();
	}, [bindings, hostWorkspaces, cache]);

	const titleResults = useQueries({
		queries: hostUrls.map((hostUrl) => ({
			queryKey: ["conversation-switcher-titles", hostUrl],
			queryFn: async () => {
				const { sessions } =
					await getHostServiceClientByUrl(hostUrl).terminal.list.query();
				return sessions.map((session): TitleEntries[number] => [
					session.terminalId,
					{
						customTitle: cleanTitle(session.customTitle),
						runtimeTitle: cleanTitle(session.title),
					},
				]);
			},
			staleTime: 10_000,
		})),
		combine: titlesByHost,
	});
	const titles = useMemo(
		() => new Map(titleResults.flatMap((entries) => entries ?? [])),
		[titleResults],
	);

	const collections = useCollections();
	const { data: localRows = [] } = useLiveQuery(
		(query) => query.from({ state: collections.v2WorkspaceLocalState }),
		[collections],
	);
	const tabNames = useMemo(
		() =>
			new Map(
				localRows.flatMap((row) => [...terminalTabNames(row.paneLayout)]),
			),
		[localRows],
	);

	return useMemo(
		() =>
			buildSwitcherConversations({
				bindings,
				workspaces,
				terminalSeenAt,
				titles,
				tabNames,
			}),
		[bindings, workspaces, terminalSeenAt, titles, tabNames],
	);
}
