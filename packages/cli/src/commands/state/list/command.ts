import { boolean, string, table } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localHostClient } from "../../../lib/local-host";

export default command({
	description:
		"List pinned conversation states: this conversation's by default, --all for every conversation on this machine. A conversation without a pin follows the state the app infers",
	options: {
		all: boolean().desc("Every conversation on this machine"),
		workspace: string().desc("Only this workspace's conversations"),
		terminal: string().desc("Only this conversation (terminal ID)"),
	},
	display: (data) =>
		table(
			((data ?? []) as Record<string, unknown>[]).map((mark) => ({
				...mark,
				setAt: new Date(mark.setAt as number).toISOString(),
			})),
			["workspaceId", "terminalId", "state", "setBy", "setAt"],
			["WORKSPACE", "TERMINAL", "STATE", "BY", "SINCE"],
		),
	run: async ({ ctx, options }) => {
		const ownTerminal =
			options.all || options.workspace
				? undefined
				: process.env.SUPERSET_TERMINAL_ID;
		const terminalId = options.terminal ?? ownTerminal;
		return (await localHostClient(ctx)).conversationStates.list.query({
			...(options.workspace ? { workspaceId: options.workspace } : {}),
			...(terminalId ? { terminalId } : {}),
		});
	},
});
