import { useQueries, useQuery } from "@tanstack/react-query";
import {
	getHostServiceClientByUrl,
	hostServiceQueryRetry,
	hostServiceQueryRetryDelay,
} from "renderer/lib/host-service-client";
import { fetchHostMetrics, type HostMetricsResult } from "./fetchHostMetrics";

export const HOST_METRICS_POLL_MS = 5_000;

export function hostMetricsQueryKey(hostUrl: string | null) {
	return ["host-metrics", hostUrl] as const;
}

function hostMetricsQueryOptions(hostUrl: string | null, enabled: boolean) {
	return {
		queryKey: hostMetricsQueryKey(hostUrl),
		queryFn: () => {
			if (!hostUrl) throw new Error("no host url");
			return fetchHostMetrics(getHostServiceClientByUrl(hostUrl));
		},
		enabled: enabled && hostUrl !== null,
		refetchInterval: (query: { state: { data?: HostMetricsResult } }) =>
			query.state.data?.status === "unsupported" ? false : HOST_METRICS_POLL_MS,
		retry: hostServiceQueryRetry,
		retryDelay: hostServiceQueryRetryDelay,
	};
}

/** Live load of one host, polled every 5 s while `enabled`. */
export function useHostMetrics(hostUrl: string | null, enabled = true) {
	return useQuery(hostMetricsQueryOptions(hostUrl, enabled));
}

/** `useHostMetrics` for a list of hosts, in the same order. */
export function useHostsMetrics(hostUrls: Array<string | null>) {
	return useQueries({
		queries: hostUrls.map((hostUrl) => hostMetricsQueryOptions(hostUrl, true)),
	});
}
