import { boolean, string, table } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localHostClient } from "../../../lib/local-host";

export default command({
	description:
		"List the labels and whether this workspace has them, or --all for every labeled workspace",
	options: {
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		all: boolean().desc("Every labeled workspace on this machine"),
	},
	display: (data) => {
		const rows = (data ?? []) as Record<string, unknown>[];
		return "workspaceId" in (rows[0] ?? {})
			? table(rows, ["workspaceId", "labels"], ["WORKSPACE", "LABELS"])
			: table(rows, ["name", "color", "on"], ["LABEL", "COLOR", "ON"]);
	},
	run: async ({ ctx, options }) => {
		const { labels, assignments } = await (
			await localHostClient(ctx)
		).workspaceLabels.list.query();
		const nameOf = new Map(labels.map((label) => [label.id, label.name]));
		if (options.all) {
			return Object.entries(assignments).map(([workspaceId, ids]) => ({
				workspaceId,
				labels: ids.map((id) => nameOf.get(id)).join(", "),
			}));
		}
		const workspaceId = options.workspace ?? process.env.SUPERSET_WORKSPACE_ID;
		const on = new Set(workspaceId ? (assignments[workspaceId] ?? []) : []);
		return labels.map((label) => ({
			...label,
			on: on.has(label.id) ? "✓" : "",
		}));
	},
});
