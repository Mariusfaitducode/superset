import { useQuery } from "@tanstack/react-query";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";

export type HostConversationTodo = Awaited<
	ReturnType<HostServiceClient["conversationTodos"]["list"]["query"]>
>[number];

const hostsWithoutTodos = new Set<string>();

export function hostConversationTodosQueryKey(hostUrl: string | null) {
	return ["host-conversation-todos", hostUrl] as const;
}

/**
 * Every to-do on a host, in one query shared by the sidebar rows and the
 * Workspaces page: dozens of workspaces must not each poll their own list.
 * Polled, since agents change to-dos from the CLI. Null on hosts too old to
 * keep to-dos.
 */
export function useHostConversationTodos<T = HostConversationTodo[] | null>(
	hostUrl: string | null,
	{
		enabled = true,
		select,
	}: {
		enabled?: boolean;
		select?: (todos: HostConversationTodo[] | null) => T;
	} = {},
) {
	return useQuery({
		queryKey: hostConversationTodosQueryKey(hostUrl),
		enabled: enabled && hostUrl !== null && !hostsWithoutTodos.has(hostUrl),
		queryFn: async (): Promise<HostConversationTodo[] | null> => {
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
		select,
		refetchInterval: 10_000,
		staleTime: 5_000,
		placeholderData: (previous) => previous,
	});
}
