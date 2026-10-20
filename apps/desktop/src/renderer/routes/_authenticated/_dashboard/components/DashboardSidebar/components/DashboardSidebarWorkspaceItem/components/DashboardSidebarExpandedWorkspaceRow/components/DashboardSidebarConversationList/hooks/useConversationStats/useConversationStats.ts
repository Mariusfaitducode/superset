import { useQuery } from "@tanstack/react-query";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
	hostServiceQueryRetry,
	hostServiceQueryRetryDelay,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";

export type ConversationStats = NonNullable<
	Awaited<
		ReturnType<HostServiceClient["terminalAgents"]["sessionStats"]["query"]>
	>
>;

const hostsWithoutSessionStats = new Set<string>();

/**
 * The conversation's context use and token totals from its host. Hosts too
 * old to have `sessionStats` answer null and are not asked again.
 */
export function useConversationStats({
	workspaceId,
	hostId,
	terminalId,
	lastEventAt,
	enabled,
}: {
	workspaceId: string;
	hostId: string;
	terminalId: string;
	lastEventAt: number;
	enabled: boolean;
}): ConversationStats | null {
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: cache.resolveHostUrl(hostId);

	const query = useQuery({
		queryKey: [
			"sidebar-conversation-stats",
			hostUrl,
			workspaceId,
			terminalId,
			lastEventAt,
		],
		enabled:
			enabled && hostUrl !== null && !hostsWithoutSessionStats.has(hostUrl),
		queryFn: async (): Promise<ConversationStats | null> => {
			if (!hostUrl || hostsWithoutSessionStats.has(hostUrl)) return null;
			try {
				return await getHostServiceClientByUrl(
					hostUrl,
				).terminalAgents.sessionStats.query({ workspaceId, terminalId });
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutSessionStats.add(hostUrl);
				return null;
			}
		},
		placeholderData: (previous) => previous,
		refetchInterval: 30_000,
		staleTime: 15_000,
		retry: hostServiceQueryRetry,
		retryDelay: hostServiceQueryRetryDelay,
	});

	return enabled ? (query.data ?? null) : null;
}
