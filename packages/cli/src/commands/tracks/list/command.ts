import { boolean, table } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localTracksClient, taskRows } from "../../../lib/tracks";

export default command({
	description:
		"List tracked tasks: this conversation's by default, --all for every conversation on this machine",
	options: {
		all: boolean().desc("Every conversation on this machine"),
		archived: boolean().desc("The archived ones instead"),
	},
	display: (data) =>
		table(
			taskRows((data ?? []) as Parameters<typeof taskRows>[0]),
			["id", "status", "progress", "title", "note"],
			["ID", "STATUS", "PROGRESS", "TITLE", "LAST NOTE"],
		),
	run: async ({ ctx, options }) => {
		const terminalId = options.all
			? undefined
			: process.env.SUPERSET_TERMINAL_ID;
		return (await localTracksClient(ctx)).list.query({
			...(options.archived ? { archived: true } : {}),
			...(terminalId ? { terminalId } : {}),
		});
	},
});
