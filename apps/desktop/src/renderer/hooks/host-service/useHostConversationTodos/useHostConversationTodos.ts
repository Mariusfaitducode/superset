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

/** Shared by every reader of a host's to-dos, so they make one request. */
export function hostConversationTodosQueryOptions(hostUrl: string | null) {
	return {
		queryKey: hostConversationTodosQueryKey(hostUrl),
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

/** False once a host turned out to predate to-dos. */
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
	const queryKey = hostConversationTodosQueryKey(hostUrl);
	const active = enabled && hostKeepsTodos(hostUrl);
	useHostStoreRefresh({
		hostUrl,
		store: "conversation-todos",
		queryKey,
		enabled: active,
	});
	return useQuery({
		...hostConversationTodosQueryOptions(hostUrl),
		enabled: active,
	});
}
