import type { AppRouter } from "@superset/host-service";
import type { inferRouterOutputs } from "@trpc/server";
import type { HostServiceClient } from "renderer/lib/host-service-client";
import { isMissingProcedureError } from "renderer/lib/isMissingProcedureError";

export type HostMetrics = inferRouterOutputs<AppRouter>["host"]["metrics"];

export type HostMetricsResult =
	| { status: "ok"; metrics: HostMetrics }
	/** The host runs a host-service from before `host.metrics`. */
	| { status: "unsupported" };

export async function fetchHostMetrics(
	client: Pick<HostServiceClient, "host">,
): Promise<HostMetricsResult> {
	try {
		return { status: "ok", metrics: await client.host.metrics.query() };
	} catch (error) {
		if (isMissingProcedureError(error)) return { status: "unsupported" };
		throw error;
	}
}
