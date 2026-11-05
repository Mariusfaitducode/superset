import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useHostProjects } from "renderer/hooks/host-projects/useHostProjects";
import {
	hostAgentReportsQuery,
	hostKeepsReports,
} from "renderer/hooks/host-service/useHostAgentReports";
import {
	hostConversationTodosQuery,
	hostKeepsTodos,
} from "renderer/hooks/host-service/useHostConversationTodos";
import { holdHostStoreRefresh } from "renderer/hooks/host-service/useHostStoreRefresh";
import { useAgentConversations } from "renderer/hooks/useAgentConversations";
import { useNow } from "renderer/hooks/useNow";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { localDay } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/todo-order";
import {
	groupProjectTargetsByHost,
	useProjectQueryTargets,
} from "renderer/routes/_authenticated/_dashboard/hooks/useProjectQueryTargets";
import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { getV2WorkspaceDisplayName } from "renderer/utils/getV2WorkspaceDisplayName";
import {
	buildDeskQueue,
	type DeskHostData,
	type DeskItem,
	type DeskWorkspace,
} from "./buildDeskQueue";

const pickData = <T>(results: { data?: T | null }[]) =>
	results.map((result) => result.data ?? null);

const pickPullRequests = (
	results: { data?: { pullRequests: MyPullRequestItem[] } | null }[],
) => results.map((result) => result.data?.pullRequests ?? null);

const NO_PROJECT_FILTER: string[] = [];

/**
 * Everything waiting on the user, read with the queries the rest of the app
 * already keeps, so the sidebar badge and the page share one read:
 * - reports and to-dos, from every host with a workspace in this app;
 * - conversations, from the bindings the sidebar keeps live;
 * - PRs to review, from the host's memory of the last Pull Requests "Mine"
 *   read for all projects. It never calls GitHub, so PRs show up once that
 *   page has loaded since the host started.
 * Cloud sandboxes are left out: holding their socket keeps the VM awake.
 */
export function useDeskQueue(): DeskItem[] {
	const queryClient = useQueryClient();
	const { workspaces, cache } = useHostWorkspaces();
	const { projects } = useHostProjects();
	const conversations = useAgentConversations();
	const today = localDay(useNow(60_000));

	const projectNames = useMemo(
		() =>
			new Map(projects.map((project) => [project.projectKey, project.name])),
		[projects],
	);
	const deskWorkspaces = useMemo(
		() =>
			new Map(
				workspaces.map((workspace): [string, DeskWorkspace] => [
					workspace.id,
					{
						name: getV2WorkspaceDisplayName(workspace),
						projectName:
							workspace.projectId === null
								? null
								: (projectNames.get(workspace.projectId) ?? null),
						hostUrl: cache.isSandboxHost(workspace.hostId)
							? null
							: (cache.resolveHostUrl(workspace.hostId) ?? null),
					},
				]),
			),
		[workspaces, cache, projectNames],
	);
	const hostUrlsKey = useMemo(() => {
		const urls = new Set<string>();
		for (const workspace of deskWorkspaces.values()) {
			if (workspace.hostUrl) urls.add(workspace.hostUrl);
		}
		return [...urls].sort().join("\n");
	}, [deskWorkspaces]);
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

	// Same key as the Pull Requests page's cached read, so both share it.
	const { targets } = useProjectQueryTargets(NO_PROJECT_FILTER);
	const prTargets = useMemo(
		() =>
			groupProjectTargetsByHost(targets).filter(
				(target) => target.hostUrl && target.projects.length > 0,
			),
		[targets],
	);
	const pullRequests = useQueries({
		queries: prTargets.map((target) => ({
			queryKey: ["pullRequests", "mine", "cached", target.key, target.hostUrl],
			queryFn: () =>
				getHostServiceClientByUrl(
					target.hostUrl as string,
				).workspaceCreation.listMyPullRequests.query({
					projectIds: target.projects.map((project) => project.projectId),
					cachedOnly: true,
				}),
			staleTime: 60_000,
			refetchInterval: 2 * 60_000,
			gcTime: 10 * 60_000,
		})),
		combine: pickPullRequests,
	});

	return useMemo(() => {
		const hosts: DeskHostData[] = hostUrls.map((hostUrl, index) => ({
			hostUrl,
			reports: reports[index] ?? null,
			todos: todos[index] ?? null,
			pullRequests: null,
		}));
		prTargets.forEach((target, index) => {
			hosts.push({
				hostUrl: target.hostUrl as string,
				reports: null,
				todos: null,
				pullRequests: pullRequests[index] ?? null,
			});
		});
		return buildDeskQueue({
			hosts,
			conversations,
			workspaces: deskWorkspaces,
			projectNames,
			today,
		});
	}, [
		hostUrls,
		reports,
		todos,
		prTargets,
		pullRequests,
		conversations,
		deskWorkspaces,
		projectNames,
		today,
	]);
}
