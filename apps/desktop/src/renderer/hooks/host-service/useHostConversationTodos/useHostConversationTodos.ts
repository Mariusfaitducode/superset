import { useQuery } from "@tanstack/react-query";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostStoreRefresh } from "../useHostStoreRefresh";

export type ConversationTodo = Awaited<
	ReturnType<HostServiceClient["conversationTodos"]["list"]["query"]>
>[number];

const hostsWithoutTodos = new Set<string>();

export function hostConversationTodosQueryKey(hostUrl: string | null) {
	return ["host-conversation-todos", hostUrl] as const;
}

/** Null on hosts too old to keep to-dos; they are not asked again. */
export async function fetchHostConversationTodos(
	hostUrl: string,
): Promise<ConversationTodo[] | null> {
	if (hostsWithoutTodos.has(hostUrl)) return null;
	try {
		return await getHostServiceClientByUrl(
			hostUrl,
		).conversationTodos.list.query({});
	} catch (error) {
		if (!isMissingProcedureError(error)) throw error;
		hostsWithoutTodos.add(hostUrl);
		return null;
	}
}

/**
 * The query for every to-do of a host, for callers that read several hosts
 * at once. Null data on hosts too old to keep to-dos.
 */
export function hostConversationTodosQuery(hostUrl: string | null) {
	return {
		queryKey: hostConversationTodosQueryKey(hostUrl),
		queryFn: (): Promise<ConversationTodo[] | null> =>
			hostUrl ? fetchHostConversationTodos(hostUrl) : Promise.resolve(null),
		refetchInterval: 60_000,
		staleTime: 5_000,
	};
}

export function hostKeepsTodos(hostUrl: string | null): boolean {
	return hostUrl !== null && !hostsWithoutTodos.has(hostUrl);
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
	const query = hostConversationTodosQuery(hostUrl);
	const active = enabled && hostKeepsTodos(hostUrl);
	useHostStoreRefresh({
		hostUrl,
		store: "conversation-todos",
		queryKey: query.queryKey,
		enabled: active,
	});
	return useQuery({
		...query,
		enabled: active,
		placeholderData: (previous) => previous,
	});
}
