import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";

export type GrantsState = Awaited<
	ReturnType<HostServiceClient["workspaceGrants"]["list"]["query"]>
>;
export type GrantId = GrantsState["available"][number]["id"];

const hostsWithoutGrants = new Set<string>();

function grantsQueryKey(hostUrl: string | null) {
	return ["workspace-grants", hostUrl] as const;
}

/**
 * One host's grants and the call that changes a workspace's. Null state on
 * hosts too old to keep grants.
 */
export function useHostGrants(hostId: string) {
	const queryClient = useQueryClient();
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: cache.resolveHostUrl(hostId);

	const query = useQuery({
		queryKey: grantsQueryKey(hostUrl),
		enabled: hostUrl !== null && !hostsWithoutGrants.has(hostUrl),
		queryFn: async (): Promise<GrantsState | null> => {
			if (!hostUrl) return null;
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).workspaceGrants.list.query();
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutGrants.add(hostUrl);
				return null;
			}
		},
		// Read when the menu opens; a coordinator may have changed them.
		staleTime: 5_000,
	});

	const setGrants = useCallback(
		async (workspaceId: string, grants: GrantId[]) => {
			if (!hostUrl) return;
			await getHostServiceClientByUrl(hostUrl).workspaceGrants.set.mutate({
				workspaceId,
				grants,
			});
			await queryClient.invalidateQueries({
				queryKey: grantsQueryKey(hostUrl),
			});
		},
		[hostUrl, queryClient],
	);

	return { state: query.data ?? null, setGrants };
}
