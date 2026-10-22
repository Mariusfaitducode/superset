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
 *
 * The totals only move while the agent works. A working agent re-stamps
 * `lastEventAt` on every tool call, so it is read every 30 s instead of on
 * each stamp; any other conversation is read once per state change and
 * never polled.
 */
export function useConversationStats({
	workspaceId,
	hostId,
	terminalId,
	lastEventAt,
	working,
	enabled,
}: {
	workspaceId: string;
	hostId: string;
	terminalId: string;
	lastEventAt: number;
	working: boolean;
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
			working ? "working" : lastEventAt,
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
		refetchInterval: working ? 30_000 : false,
		staleTime: working ? 15_000 : Number.POSITIVE_INFINITY,
		retry: hostServiceQueryRetry,
		retryDelay: hostServiceQueryRetryDelay,
	});

	return enabled ? (query.data ?? null) : null;
}
