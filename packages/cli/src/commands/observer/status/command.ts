import { number, table } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localHostClient } from "../../../lib/local-host";

export default command({
	description:
		"The observer's latest runs on this machine, newest first: where each ran, its state and headline",
	options: {
		limit: number().int().min(1).max(20).desc("How many runs (default 5)"),
	},
	display: (data) =>
		table(
			(
				(
					data as {
						runs: {
							id: string;
							workspaceId: string;
							status: string;
							startedAt: number;
							synthesis: { headline: string } | null;
						}[];
					} | null
				)?.runs ?? []
			).map((run) => ({
				id: run.id.slice(0, 8),
				workspace: run.workspaceId,
				status: run.status,
				started: new Date(run.startedAt).toLocaleString(),
				headline: run.synthesis?.headline ?? "",
			})),
			["id", "workspace", "status", "started", "headline"],
			["ID", "WORKSPACE", "STATUS", "STARTED", "HEADLINE"],
		),
	run: async ({ ctx, options }) => ({
		data: await (await localHostClient(ctx)).officeObserver.get.query({
			limit: options.limit ?? 5,
		}),
	}),
});
