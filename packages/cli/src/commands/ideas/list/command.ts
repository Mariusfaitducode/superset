import { boolean, string, table } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { ideaRows, ideaWorkspace, localIdeasClient } from "../../../lib/ideas";

export default command({
	description:
		"List ideas: this workspace's by default, --all for every workspace on this machine",
	options: {
		all: boolean().desc("Every workspace on this machine"),
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		open: boolean().desc("Only the open and kept ones"),
	},
	display: (data) =>
		table(
			ideaRows((data ?? []) as Parameters<typeof ideaRows>[0]),
			["id", "status", "by", "text"],
			["ID", "STATUS", "BY", "TEXT"],
		),
	run: async ({ ctx, options }) => {
		const ideas = await (await localIdeasClient(ctx)).list.query(
			options.all
				? {}
				: { workspaceId: ideaWorkspace(options.workspace ?? undefined) },
		);
		return options.open
			? ideas.filter((idea) => idea.status === "open" || idea.status === "kept")
			: ideas;
	},
});
