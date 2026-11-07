import { useQuery } from "@tanstack/react-query";
import {
	getHostServiceClientByUrl,
	type HostServiceClient,
} from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";
import { useHostStoreRefresh } from "../useHostStoreRefresh";

export type AgentReport = Awaited<
	ReturnType<HostServiceClient["agentReports"]["list"]["query"]>
>[number];

const hostsWithoutReports = new Set<string>();

export function hostAgentReportsQueryKey(hostUrl: string | null) {
	return ["host-agent-reports", hostUrl] as const;
}

/** The open reports of a host. Null data on hosts too old to keep them. */
export function hostAgentReportsQuery(hostUrl: string | null) {
	return {
		queryKey: hostAgentReportsQueryKey(hostUrl),
		queryFn: async (): Promise<AgentReport[] | null> => {
			if (!hostUrl) return null;
			try {
				return await getHostServiceClientByUrl(hostUrl).agentReports.list.query(
					{ status: "open" },
				);
			} catch (error) {
				if (!isMissingProcedureError(error)) throw error;
				hostsWithoutReports.add(hostUrl);
				return null;
			}
		},
		refetchInterval: 60_000,
		staleTime: 5_000,
	};
}

export function hostKeepsReports(hostUrl: string | null): boolean {
	return hostUrl !== null && !hostsWithoutReports.has(hostUrl);
}

/**
 * Every open report of a host in one read, shared by the sidebar rows. The
 * host says when they change; the slow poll covers a missed event.
 */
export function useHostAgentReports(hostUrl: string | null, enabled: boolean) {
	const query = hostAgentReportsQuery(hostUrl);
	const active = enabled && hostKeepsReports(hostUrl);
	useHostStoreRefresh({
		hostUrl,
		store: "agent-reports",
		queryKey: query.queryKey,
		enabled: active,
	});
	return useQuery({
		...query,
		enabled: active,
		placeholderData: (previous) => previous,
	});
}
