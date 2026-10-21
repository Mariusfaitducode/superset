import { useQuery } from "@tanstack/react-query";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";

export type HostAgentBinding = Awaited<
	ReturnType<HostServiceClient["terminalAgents"]["list"]["query"]>
>[number];
export type HostTodo = Awaited<
	ReturnType<HostServiceClient["conversationTodos"]["list"]["query"]>
>[number];

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

const hostsWithoutTodos = new Set<string>();

export function useHostTodos(hostId: string): HostTodo[] {
	const hostUrl = useHostUrl(hostId);
	const query = useQuery({
		queryKey: ["workspace-insights", "todos", hostUrl],
		enabled: hostUrl !== null && !hostsWithoutTodos.has(hostUrl),
		queryFn: async (): Promise<HostTodo[]> => {
			if (!hostUrl) return [];
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).conversationTodos.list.query({});
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutTodos.add(hostUrl);
				return [];
			}
		},
		refetchInterval: 15_000,
		staleTime: 10_000,
	});
	return query.data ?? [];
}
