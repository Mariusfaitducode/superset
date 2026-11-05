import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import {
	holdHostStoreRefresh,
	useHostStoreRefresh,
} from "../useHostStoreRefresh";

export type ConversationTodo = Awaited<
	ReturnType<HostServiceClient["conversationTodos"]["list"]["query"]>
>[number];

const hostsWithoutTodos = new Set<string>();

export function hostConversationTodosQueryKey(hostUrl: string | null) {
	return ["host-conversation-todos", hostUrl] as const;
}

function isActive(hostUrl: string | null, enabled: boolean) {
	return enabled && hostUrl !== null && !hostsWithoutTodos.has(hostUrl);
}

function hostConversationTodosQuery(hostUrl: string | null, enabled: boolean) {
	return {
		queryKey: hostConversationTodosQueryKey(hostUrl),
		enabled: isActive(hostUrl, enabled),
		queryFn: async (): Promise<ConversationTodo[] | null> => {
			if (!hostUrl) return null;
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).conversationTodos.list.query({});
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutTodos.add(hostUrl);
				return null;
			}
		},
		refetchInterval: 60_000,
		staleTime: 5_000,
		placeholderData: (previous: ConversationTodo[] | null | undefined) =>
			previous,
	};
}

/**
 * Every to-do of a host in one read, shared by all sidebar rows and the
 * Workspaces page. The host says when they change; the slow poll only
 * covers a missed event or a host that predates it. Null data on hosts too
 * old to keep to-dos.
 */
export function useHostConversationTodos(
	hostUrl: string | null,
	enabled: boolean,
) {
	useHostStoreRefresh({
		hostUrl,
		store: "conversation-todos",
		queryKey: hostConversationTodosQueryKey(hostUrl),
		enabled: isActive(hostUrl, enabled),
	});
	return useQuery(hostConversationTodosQuery(hostUrl, enabled));
}

// Module-level so react-query can keep the combined result stable.
function flattenTodos(
	results: Array<{ data?: ConversationTodo[] | null }>,
): ConversationTodo[] {
	return results.flatMap((result) => result.data ?? []);
}

/** Every to-do of several hosts, read through the same per-host query. */
export function useConversationTodosOfHosts(
	hostUrls: string[],
): ConversationTodo[] {
	const queryClient = useQueryClient();
	const key = [...new Set(hostUrls)].sort().join("\n");
	const unique = useMemo(() => (key ? key.split("\n") : []), [key]);
	useEffect(() => {
		const releases = unique
			.filter((hostUrl) => isActive(hostUrl, true))
			.map((hostUrl) =>
				holdHostStoreRefresh(
					hostUrl,
					"conversation-todos",
					queryClient,
					hostConversationTodosQueryKey(hostUrl),
				),
			);
		return () => {
			for (const release of releases) release();
		};
	}, [unique, queryClient]);
	return useQueries({
		queries: unique.map((hostUrl) => hostConversationTodosQuery(hostUrl, true)),
		combine: flattenTodos,
	});
}
