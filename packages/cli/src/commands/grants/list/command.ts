import { boolean, string, table } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { grantWorkspace, localGrantsClient } from "../../../lib/grants";

export default command({
	description:
		"List the grants and whether this workspace has them, or --all for every granted workspace",
	options: {
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		all: boolean().desc("Every granted workspace on this machine"),
	},
	display: (data) => {
		const rows = (data ?? []) as Record<string, unknown>[];
		return "workspaceId" in (rows[0] ?? {})
			? table(rows, ["workspaceId", "grants"], ["WORKSPACE", "GRANTS"])
			: table(
					rows,
					["id", "granted", "description"],
					["GRANT", "ON", "WHAT IT ALLOWS"],
				);
	},
	run: async ({ ctx, options }) => {
		const { available, workspaces } = await (
			await localGrantsClient(ctx)
		).list.query();
		if (options.all) {
			return Object.entries(workspaces).map(([workspaceId, entry]) => ({
				workspaceId,
				grants: entry.grants.join(", "),
			}));
		}
		const workspaceId = grantWorkspace(options.workspace ?? undefined);
		const on = new Set<string>(workspaces[workspaceId]?.grants ?? []);
		return available.map((grant) => ({
			...grant,
			granted: on.has(grant.id) ? "✓" : "",
		}));
	},
});
