import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import {
	type IdeaStatus,
	isActiveIdea,
	sortIdeas,
	type WorkspaceIdea,
} from "./ideas";

const hostsWithoutIdeas = new Set<string>();

// The host takes at most this many ideas per call.
const ADD_BATCH = 200;

export interface IdeaActions {
	add: (texts: string[]) => Promise<void>;
	update: (
		id: string,
		fields: { text?: string; note?: string | null },
	) => Promise<void>;
	setStatus: (id: string, status: IdeaStatus) => Promise<void>;
	remove: (id: string) => Promise<void>;
}

/**
 * A workspace's ideas, from its host, where agents read and add them too.
 * One polled query per host serves every row of that host. `ideas` is null
 * on hosts too old to keep ideas.
 */
export function useWorkspaceIdeas(workspaceId: string, hostId: string) {
	const queryClient = useQueryClient();
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: cache.resolveHostUrl(hostId);
	const queryKey = useMemo(() => ["workspace-ideas", hostUrl], [hostUrl]);

	const query = useQuery({
		queryKey,
		enabled: hostUrl !== null && !hostsWithoutIdeas.has(hostUrl),
		queryFn: async (): Promise<WorkspaceIdea[] | null> => {
			if (!hostUrl) return null;
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).workspaceIdeas.list.query({});
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutIdeas.add(hostUrl);
				return null;
			}
		},
		// Agents add ideas from the CLI.
		refetchInterval: 10_000,
		staleTime: 5_000,
		placeholderData: (previous) => previous,
	});

	const ideas = useMemo(
		() =>
			query.data
				? sortIdeas(
						query.data.filter((idea) => idea.workspaceId === workspaceId),
					)
				: null,
		[query.data, workspaceId],
	);
	const activeCount = ideas?.filter(isActiveIdea).length ?? 0;

	const mutate = useCallback(
		async (
			call: (client: HostServiceClient["workspaceIdeas"]) => Promise<unknown>,
		) => {
			if (!hostUrl) return;
			await call(getHostServiceClientByUrl(hostUrl).workspaceIdeas);
			await queryClient.invalidateQueries({ queryKey });
		},
		[hostUrl, queryClient, queryKey],
	);

	const actions = useMemo<IdeaActions>(
		() => ({
			add: (texts) =>
				mutate(async (client) => {
					for (let i = 0; i < texts.length; i += ADD_BATCH) {
						await client.add.mutate({
							workspaceId,
							items: texts.slice(i, i + ADD_BATCH).map((text) => ({ text })),
						});
					}
				}),
			update: (id, fields) =>
				mutate((client) => client.update.mutate({ id, ...fields })),
			setStatus: (id, status) =>
				mutate((client) => client.setStatus.mutate({ id, status })),
			remove: (id) => mutate((client) => client.remove.mutate({ id })),
		}),
		[mutate, workspaceId],
	);

	return { ideas, activeCount, actions };
}
