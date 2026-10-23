import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
	hostAgentReportsQuery,
	hostKeepsReports,
} from "renderer/hooks/host-service/useHostAgentReports";
import {
	hostConversationTodosQuery,
	hostKeepsTodos,
} from "renderer/hooks/host-service/useHostConversationTodos";
import { holdHostStoreRefresh } from "renderer/hooks/host-service/useHostStoreRefresh";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { buildDeskQueue, type DeskItem } from "./buildDeskQueue";

const pickData = <T>(results: { data?: T | null }[]) =>
	results.map((result) => result.data ?? null);

/**
 * The Desk's queue, read from every host that has a workspace in this app
 * with the same per-host queries as the sidebar, so the sidebar badge and
 * the page share one read. Cloud sandboxes are left out: holding their
 * socket keeps the VM awake.
 */
export function useDeskQueue(): DeskItem[] {
	const queryClient = useQueryClient();
	const { workspaces, cache } = useHostWorkspaces();

	const workspaceNames = useMemo(
		() =>
			new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
		[workspaces],
	);
	const hostUrlsKey = useMemo(() => {
		const urls = new Set<string>();
		for (const workspace of workspaces) {
			if (cache.isSandboxHost(workspace.hostId)) continue;
			const url = cache.resolveHostUrl(workspace.hostId);
			if (url) urls.add(url);
		}
		return [...urls].sort().join("\n");
	}, [workspaces, cache]);
	const hostUrls = useMemo(
		() => (hostUrlsKey ? hostUrlsKey.split("\n") : []),
		[hostUrlsKey],
	);

	useEffect(() => {
		const releases = hostUrls.flatMap((url) => [
			holdHostStoreRefresh(
				url,
				"agent-reports",
				queryClient,
				hostAgentReportsQuery(url).queryKey,
			),
			holdHostStoreRefresh(
				url,
				"conversation-todos",
				queryClient,
				hostConversationTodosQuery(url).queryKey,
			),
		]);
		return () => {
			for (const release of releases) release();
		};
	}, [hostUrls, queryClient]);

	const reports = useQueries({
		queries: hostUrls.map((url) => ({
			...hostAgentReportsQuery(url),
			enabled: hostKeepsReports(url),
		})),
		combine: pickData,
	});
	const todos = useQueries({
		queries: hostUrls.map((url) => ({
			...hostConversationTodosQuery(url),
			enabled: hostKeepsTodos(url),
		})),
		combine: pickData,
	});

	return useMemo(
		() =>
			buildDeskQueue(
				hostUrls.map((hostUrl, index) => ({
					hostUrl,
					reports: reports[index] ?? null,
					todos: todos[index] ?? null,
				})),
				workspaceNames,
			),
		[hostUrls, reports, todos, workspaceNames],
	);
}
