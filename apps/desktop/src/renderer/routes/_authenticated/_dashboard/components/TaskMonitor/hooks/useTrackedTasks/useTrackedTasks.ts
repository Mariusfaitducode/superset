import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { holdHostStoreRefresh } from "renderer/hooks/host-service/useHostStoreRefresh";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import type { MonitoredTask, TrackedTask } from "../../utils/task-monitor";

const hostsWithoutTasks = new Set<string>();

export function hostTrackedTasksQueryKey(hostUrl: string) {
	return ["host-tracked-tasks", hostUrl] as const;
}

function hostTrackedTasksQuery(hostUrl: string, archived: boolean) {
	return {
		queryKey: [...hostTrackedTasksQueryKey(hostUrl), { archived }] as const,
		queryFn: async (): Promise<TrackedTask[] | null> => {
			try {
				return await getHostServiceClientByUrl(hostUrl).trackedTasks.list.query(
					archived ? { archived } : {},
				);
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutTasks.add(hostUrl);
				return null;
			}
		},
		enabled: !hostsWithoutTasks.has(hostUrl),
		staleTime: 5_000,
		placeholderData: (previous: TrackedTask[] | null | undefined) => previous,
	};
}

/** The local hosts that have a workspace in this app, sorted. */
function useHostUrls(): string[] {
	const { workspaces, cache } = useHostWorkspaces();
	const key = useMemo(() => {
		const urls = new Set<string>();
		for (const workspace of workspaces) {
			// Holding a cloud sandbox's socket keeps its VM awake.
			if (cache.isSandboxHost(workspace.hostId)) continue;
			const url = cache.resolveHostUrl(workspace.hostId);
			if (url) urls.add(url);
		}
		return [...urls].sort().join("\n");
	}, [workspaces, cache]);
	return useMemo(() => (key ? key.split("\n") : []), [key]);
}

/**
 * Every tracked task of every host, open or archived. The hosts say when
 * tasks change; the poll only moves elapsed times and silence along while
 * something runs, and covers a missed event.
 */
export function useTrackedTasks({
	archived = false,
	enabled = true,
}: {
	archived?: boolean;
	enabled?: boolean;
} = {}): { tasks: MonitoredTask[]; byHost: Map<string, TrackedTask[]> } {
	const queryClient = useQueryClient();
	const hostUrls = useHostUrls();

	useEffect(() => {
		if (!enabled) return;
		const releases = hostUrls.map((url) =>
			holdHostStoreRefresh(
				url,
				"tracked-tasks",
				queryClient,
				hostTrackedTasksQueryKey(url),
			),
		);
		return () => {
			for (const release of releases) release();
		};
	}, [hostUrls, queryClient, enabled]);

	const results = useQueries({
		queries: hostUrls.map((url) => {
			const query = hostTrackedTasksQuery(url, archived);
			return {
				...query,
				enabled: enabled && query.enabled,
				refetchInterval: (state: {
					state: { data: TrackedTask[] | null | undefined };
				}) =>
					state.state.data?.some((task) => task.status === "running")
						? 30_000
						: 120_000,
			};
		}),
		combine: (entries) => entries.map((entry) => entry.data ?? null),
	});

	return useMemo(() => {
		const byHost = new Map<string, TrackedTask[]>();
		const tasks: MonitoredTask[] = [];
		hostUrls.forEach((hostUrl, index) => {
			const list = results[index];
			if (!list) return;
			byHost.set(hostUrl, list);
			for (const task of list) tasks.push({ ...task, hostUrl });
		});
		return { tasks, byHost };
	}, [hostUrls, results]);
}
