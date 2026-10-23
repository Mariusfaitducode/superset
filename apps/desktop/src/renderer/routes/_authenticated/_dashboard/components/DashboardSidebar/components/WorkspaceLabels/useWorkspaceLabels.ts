import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import {
	holdHostStoreRefresh,
	useHostStoreRefresh,
} from "renderer/hooks/host-service/useHostStoreRefresh";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import type { WorkspaceLabelsState } from "./labels";

const hostsWithoutLabels = new Set<string>();

function labelsQueryKey(hostUrl: string | null) {
	return ["workspace-labels", hostUrl] as const;
}

function labelsQuery(hostUrl: string | null, enabled = true) {
	return {
		queryKey: labelsQueryKey(hostUrl),
		enabled: enabled && hostUrl !== null && !hostsWithoutLabels.has(hostUrl),
		queryFn: async (): Promise<WorkspaceLabelsState | null> => {
			if (!hostUrl) return null;
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).workspaceLabels.list.query();
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutLabels.add(hostUrl);
				return null;
			}
		},
		// The host says when labels change; this only covers a missed event or
		// a host that predates it.
		refetchInterval: 60_000,
		staleTime: 10_000,
	};
}

function useResolveHostUrl() {
	const { cache } = useHostWorkspaces();
	return useCallback(
		(hostId: string) =>
			cache.isSandboxHost(hostId) ? null : cache.resolveHostUrl(hostId),
		[cache],
	);
}

/**
 * One host's labels and the calls that change them. Null state on hosts too
 * old to keep labels.
 */
export function useHostLabels(hostId: string | null) {
	const queryClient = useQueryClient();
	const resolveHostUrl = useResolveHostUrl();
	const hostUrl = hostId ? resolveHostUrl(hostId) : null;
	const query = useQuery(labelsQuery(hostUrl));
	useHostStoreRefresh({
		hostUrl,
		store: "workspace-labels",
		queryKey: labelsQueryKey(hostUrl),
		enabled: true,
	});

	const mutate = useCallback(
		async (
			call: (client: HostServiceClient["workspaceLabels"]) => Promise<unknown>,
		) => {
			if (!hostUrl) return;
			await call(getHostServiceClientByUrl(hostUrl).workspaceLabels);
			await queryClient.invalidateQueries({
				queryKey: labelsQueryKey(hostUrl),
			});
		},
		[hostUrl, queryClient],
	);

	const actions = useMemo(
		() => ({
			setWorkspaceLabels: (workspaceId: string, labelIds: string[]) =>
				mutate((client) =>
					client.setWorkspaceLabels.mutate({ workspaceId, labelIds }),
				),
			createLabel: (
				input: Parameters<
					HostServiceClient["workspaceLabels"]["createLabel"]["mutate"]
				>[0],
			) => mutate((client) => client.createLabel.mutate(input)),
			updateLabel: (
				input: Parameters<
					HostServiceClient["workspaceLabels"]["updateLabel"]["mutate"]
				>[0],
			) => mutate((client) => client.updateLabel.mutate(input)),
			deleteLabel: (id: string) =>
				mutate((client) => client.deleteLabel.mutate({ id })),
		}),
		[mutate],
	);

	return { state: query.data ?? null, actions };
}

/** Every listed host's labels, for filtering workspaces across hosts. */
export function useLabelsByHost(
	hostIds: string[],
	enabled: boolean,
): Map<string, WorkspaceLabelsState> {
	const resolveHostUrl = useResolveHostUrl();
	const key = [...new Set(hostIds)].sort().join(",");
	const unique = useMemo(() => (key ? key.split(",") : []), [key]);
	const queryClient = useQueryClient();
	useEffect(() => {
		if (!enabled) return;
		const releases = unique.flatMap((hostId) => {
			const hostUrl = resolveHostUrl(hostId);
			return hostUrl
				? [
						holdHostStoreRefresh(
							hostUrl,
							"workspace-labels",
							queryClient,
							labelsQueryKey(hostUrl),
						),
					]
				: [];
		});
		return () => {
			for (const release of releases) release();
		};
	}, [enabled, unique, resolveHostUrl, queryClient]);
	// A stable `combine` keeps the map, and the filters built on it, from
	// being rebuilt on every render.
	const combine = useCallback(
		(results: Array<{ data?: WorkspaceLabelsState | null }>) => {
			const map = new Map<string, WorkspaceLabelsState>();
			results.forEach((result, index) => {
				const hostId = unique[index];
				if (hostId && result.data) map.set(hostId, result.data);
			});
			return map;
		},
		[unique],
	);
	return useQueries({
		queries: unique.map((hostId) =>
			labelsQuery(resolveHostUrl(hostId), enabled),
		),
		combine,
	});
}
