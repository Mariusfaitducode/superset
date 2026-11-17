import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
	hostServiceQueryRetry,
	hostServiceQueryRetryDelay,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";

type LiveSessionStats = Awaited<
	ReturnType<HostServiceClient["terminalAgents"]["liveSessionStats"]["query"]>
>[number];

export interface OfficeSessionStats {
	/** Model and token totals per live agent, from its host's transcripts. */
	byTerminal: ReadonlyMap<string, NonNullable<LiveSessionStats["stats"]>>;
	/** Hosts that cannot tell: too old, sandboxed or unreachable. */
	unavailableHosts: ReadonlySet<string>;
}

const hostsWithoutLiveStats = new Set<string>();

/**
 * One read per host of every live agent's model and tokens. Hosts too old to
 * have `liveSessionStats` are not asked again and count as unavailable.
 */
export function useOfficeSessionStats(
	hostIds: readonly string[],
	enabled: boolean,
): OfficeSessionStats {
	const { cache } = useHostWorkspaces();
	const hosts = useMemo(
		() =>
			[...new Set(hostIds)].sort().map((hostId) => ({
				hostId,
				hostUrl: cache.isSandboxHost(hostId)
					? null
					: cache.resolveHostUrl(hostId),
			})),
		[hostIds, cache],
	);
	const results = useQueries({
		queries: hosts.map(({ hostUrl }) => ({
			queryKey: ["office-live-session-stats", hostUrl],
			enabled:
				enabled && hostUrl !== null && !hostsWithoutLiveStats.has(hostUrl),
			queryFn: async (): Promise<LiveSessionStats[] | null> => {
				if (!hostUrl || hostsWithoutLiveStats.has(hostUrl)) return null;
				try {
					return await getHostServiceClientByUrl(
						hostUrl,
					).terminalAgents.liveSessionStats.query();
				} catch (error) {
					if (!isMissingProcedureError(error)) throw error;
					hostsWithoutLiveStats.add(hostUrl);
					return null;
				}
			},
			placeholderData: (previous: LiveSessionStats[] | null | undefined) =>
				previous,
			// Tokens grow while agents work; the host answers from a cursor.
			refetchInterval: 60_000,
			staleTime: 30_000,
			retry: hostServiceQueryRetry,
			retryDelay: hostServiceQueryRetryDelay,
		})),
	});

	const dataKey = results.map((result) => result.dataUpdatedAt).join(",");
	// biome-ignore lint/correctness/useExhaustiveDependencies: results is a new array each render; dataKey tracks its data
	return useMemo(() => {
		const byTerminal = new Map<
			string,
			NonNullable<LiveSessionStats["stats"]>
		>();
		const unavailableHosts = new Set<string>();
		hosts.forEach(({ hostId }, index) => {
			const data = results[index]?.data;
			if (!data) {
				unavailableHosts.add(hostId);
				return;
			}
			for (const row of data) {
				if (row.stats) byTerminal.set(row.terminalId, row.stats);
			}
		});
		return { byTerminal, unavailableHosts };
	}, [hosts, dataKey]);
}
