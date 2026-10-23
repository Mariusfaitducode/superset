import { useQuery } from "@tanstack/react-query";
import {
	type ConversationTodo,
	useHostConversationTodos,
} from "renderer/hooks/host-service/useHostConversationTodos";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";

export type HostAgentBinding = Awaited<
	ReturnType<HostServiceClient["terminalAgents"]["list"]["query"]>
>[number];
export type HostTodo = ConversationTodo;

function useHostUrl(hostId: string): string | null {
	const { cache } = useHostWorkspaces();
	return cache.isSandboxHost(hostId) ? null : cache.resolveHostUrl(hostId);
}

/**
 * One query per host for the whole board, shared by every card on it: a
 * hundred cards must not fan out a hundred calls.
 */
export function useHostAgentBindings(hostId: string): HostAgentBinding[] {
	const hostUrl = useHostUrl(hostId);
	const query = useQuery({
		queryKey: ["workspace-insights", "agents", hostUrl],
		enabled: hostUrl !== null,
		queryFn: () =>
			hostUrl
				? getHostServiceClientByUrl(hostUrl).terminalAgents.list.query()
				: [],
		refetchInterval: 10_000,
		staleTime: 5_000,
	});
	return query.data ?? [];
}

/** The same per-host read as the sidebar's to-dos. */
export function useHostTodos(hostId: string): HostTodo[] {
	const hostUrl = useHostUrl(hostId);
	return useHostConversationTodos(hostUrl, true).data ?? [];
}
