import { boolean, string, table } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localNotesClient, noteRows, noteWorkspace } from "../../../lib/notes";

export default command({
	description:
		"List notes: this workspace's by default, --all for every workspace on this machine",
	options: {
		all: boolean().desc("Every workspace on this machine"),
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		open: boolean().desc("Only the open and kept ones"),
	},
	display: (data) =>
		table(
			noteRows((data ?? []) as Parameters<typeof noteRows>[0]),
			["id", "status", "by", "text"],
			["ID", "STATUS", "BY", "TEXT"],
		),
	run: async ({ ctx, options }) => {
		const notes = await (await localNotesClient(ctx)).list.query(
			options.all
				? {}
				: { workspaceId: noteWorkspace(options.workspace ?? undefined) },
		);
		return options.open
			? notes.filter((note) => note.status === "open" || note.status === "kept")
			: notes;
	},
});
