import { boolean, string, table } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localReportsClient, reportRows } from "../../../lib/reports";

export default command({
	description:
		"List reports: this conversation's by default, --all for every conversation on this machine",
	options: {
		all: boolean().desc("Every conversation on this machine"),
		workspace: string().desc("Only this workspace's conversations"),
		terminal: string().desc("Only this conversation (terminal ID)"),
		open: boolean().desc("Only the ones still waiting on the user"),
	},
	display: (data) =>
		table(
			reportRows((data ?? []) as Parameters<typeof reportRows>[0]),
			["id", "kind", "status", "summary", "answer"],
			["ID", "KIND", "STATUS", "SUMMARY", "ANSWER"],
		),
	run: async ({ ctx, options }) => {
		const ownTerminal =
			options.all || options.workspace
				? undefined
				: process.env.SUPERSET_TERMINAL_ID;
		return (await localReportsClient(ctx)).list.query({
			...(options.workspace ? { workspaceId: options.workspace } : {}),
			...((options.terminal ?? ownTerminal)
				? { terminalId: options.terminal ?? ownTerminal }
				: {}),
			...(options.open ? { status: "open" as const } : {}),
		});
	},
});
