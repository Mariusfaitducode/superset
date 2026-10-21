import { positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { findLabels, labelWorkspace } from "../../../lib/labels";
import { localHostClient } from "../../../lib/local-host";

export default command({
	description: "Put labels on this workspace",
	args: [
		positional("names")
			.variadic()
			.required()
			.desc('Label names, e.g. Waiting "Top priority"'),
	],
	options: {
		workspace: string().desc("Workspace ID (default: this terminal's)"),
	},
	run: async ({ ctx, args, options }) => {
		const client = (await localHostClient(ctx)).workspaceLabels;
		const workspaceId = labelWorkspace(options.workspace ?? undefined);
		const { labels, assignments } = await client.list.query();
		const picked = new Set(
			findLabels(args.names as string[], labels).map((label) => label.id),
		);
		const current = assignments[workspaceId] ?? [];
		const next = [...current, ...picked];
		const ids = await client.setWorkspaceLabels.mutate({
			workspaceId,
			labelIds: next,
		});
		const names = labels
			.filter((label) => ids.includes(label.id))
			.map((label) => label.name);
		return {
			data: { workspaceId, labels: names },
			message: names.length ? `Labels: ${names.join(", ")}` : "No labels",
		};
	},
});
