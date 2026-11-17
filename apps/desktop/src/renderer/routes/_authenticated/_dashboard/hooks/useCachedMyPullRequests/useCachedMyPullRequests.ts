import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import {
	groupProjectTargetsByHost,
	type HostQueryTarget,
	useProjectQueryTargets,
} from "renderer/routes/_authenticated/_dashboard/hooks/useProjectQueryTargets";
import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";

const NO_PROJECT_FILTER: string[] = [];

/**
 * The host's memory of the last Pull Requests "Mine" read, under the same
 * key as the PR page's cached read so every reader shares it. It never calls
 * GitHub: PRs show up once that page has loaded since the host started.
 */
export function cachedMyPullRequestsQuery(target: HostQueryTarget) {
	return {
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
	};
}

/** The hosts to ask, one target per host with projects. */
export function useCachedPullRequestTargets(): HostQueryTarget[] {
	const { targets } = useProjectQueryTargets(NO_PROJECT_FILTER);
	return useMemo(
		() =>
			groupProjectTargetsByHost(targets).filter(
				(target) => target.hostUrl && target.projects.length > 0,
			),
		[targets],
	);
}

const combine = (
	results: { data?: { pullRequests: MyPullRequestItem[] } | null }[],
) => results.flatMap((result) => result.data?.pullRequests ?? []);

/** Every open PR of the user across hosts, from the hosts' cache. */
export function useCachedMyPullRequests(): MyPullRequestItem[] {
	const targets = useCachedPullRequestTargets();
	return useQueries({
		queries: targets.map(cachedMyPullRequestsQuery),
		combine,
	});
}
