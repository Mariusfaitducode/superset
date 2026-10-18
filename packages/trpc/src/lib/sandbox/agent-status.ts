import { timingSafeEqual } from "node:crypto";
import { db } from "@superset/db/client";
import { cloudWorkspaces } from "@superset/db/schema";
import type { ActiveAgentStatus } from "@superset/shared/agent-status";
import { and, eq, ne } from "drizzle-orm";
import { nudge } from "../realtime";
import { sandboxHostSecretFor } from "./access";
import { extendSandbox } from "./vercel";

/** A turn `working` for longer than this is taken as hung and stops keeping its box alive. */
export const WORKING_KEEPALIVE_CAP_MS = 4 * 60 * 60 * 1000;

export type ReportSandboxAgentStatusOutcome = "ok" | "unauthorized" | "unknown";

export async function reportSandboxAgentStatus(
	args: {
		workspaceId: string;
		presentedSecret: string;
		status: ActiveAgentStatus | null;
		at: number;
	},
	deps: {
		extend: (providerSandboxId: string) => Promise<Date | null>;
		now: () => number;
	} = { extend: extendSandbox, now: Date.now },
): Promise<ReportSandboxAgentStatusOutcome> {
	const expected = Buffer.from(await sandboxHostSecretFor(args.workspaceId));
	const presented = Buffer.from(args.presentedSecret);
	if (
		expected.length !== presented.length ||
		!timingSafeEqual(expected, presented)
	) {
		return "unauthorized";
	}
	const live = and(
		eq(cloudWorkspaces.id, args.workspaceId),
		ne(cloudWorkspaces.status, "deleted"),
	);
	const row = await db.query.cloudWorkspaces.findFirst({
		where: live,
		columns: {
			organizationId: true,
			status: true,
			providerSandboxId: true,
			agentStatus: true,
			agentStatusAt: true,
		},
	});
	if (!row) return "unknown";
	// The box repeats `working` with the same `at` as a keepalive. A box that
	// booted again sends a new `at`, which replaces a status its last session left.
	const repeated =
		row.agentStatus === args.status && row.agentStatusAt?.getTime() === args.at;
	if (!repeated) {
		await db
			.update(cloudWorkspaces)
			.set({ agentStatus: args.status, agentStatusAt: new Date(args.at) })
			.where(live);
		nudge(row.organizationId, "cloud_workspaces", {
			kind: "cloud_workspaces",
			workspaceId: args.workspaceId,
			agentStatus: args.status,
			agentStatusAt: args.at,
		});
	}
	const hung = deps.now() - args.at > WORKING_KEEPALIVE_CAP_MS;
	if (args.status === "working" && row.status === "ready" && !hung) {
		await deps
			.extend(row.providerSandboxId)
			.catch((error: unknown) =>
				console.warn(
					`[sandbox-agent-status] extend failed for ${args.workspaceId}`,
					error,
				),
			);
	}
	return "ok";
}
