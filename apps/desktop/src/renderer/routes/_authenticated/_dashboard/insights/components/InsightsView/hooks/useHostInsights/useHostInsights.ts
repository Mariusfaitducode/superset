import type { AppRouter } from "@superset/host-service";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";

export type InsightsSummary =
	inferRouterOutputs<AppRouter>["insights"]["summary"];

const STALE_MS = 5 * 60 * 1000;
const CATCH_UP_POLL_MS = 5_000;

/**
 * The host rescans only the transcript bytes appended since its last scan,
 * so a refetch is cheap once the first scan is done. Until then the host
 * answers with what it read so far and this polls until it is complete.
 */
export function useHostInsights(hostUrl: string | null, days: number) {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return useQuery({
		queryKey: ["host-insights", hostUrl, days, timeZone] as const,
		enabled: !!hostUrl,
		queryFn: () => {
			if (!hostUrl) return null;
			return getHostServiceClientByUrl(hostUrl).insights.summary.query({
				days,
				timeZone,
			});
		},
		staleTime: STALE_MS,
		refetchInterval: (query) =>
			query.state.data && !query.state.data.complete ? CATCH_UP_POLL_MS : false,
		retry: false,
		placeholderData: (previousData, previousQuery) =>
			previousQuery?.queryKey[1] === hostUrl ? previousData : undefined,
	});
}
