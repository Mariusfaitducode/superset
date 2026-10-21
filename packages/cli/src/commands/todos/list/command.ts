import { boolean, string, table } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localTodosClient, todoRows } from "../../../lib/todos";

export default command({
	description:
		"List to-dos: this conversation's by default, --all for every conversation on this machine",
	options: {
		all: boolean().desc("Every conversation on this machine"),
		workspace: string().desc("Only this workspace's conversations"),
		terminal: string().desc("Only this conversation (terminal ID)"),
		open: boolean().desc("Hide the checked ones"),
	},
	display: (data) =>
		table(
			todoRows((data ?? []) as Parameters<typeof todoRows>[0]),
			["id", "done", "priority", "kind", "due", "by", "text"],
			["ID", "DONE", "PRIORITY", "KIND", "DUE", "BY", "TEXT"],
		),
	run: async ({ ctx, options }) => {
		const ownTerminal =
			options.all || options.workspace
				? undefined
				: process.env.SUPERSET_TERMINAL_ID;
		const todos = await (await localTodosClient(ctx)).list.query({
			...(options.workspace ? { workspaceId: options.workspace } : {}),
			...((options.terminal ?? ownTerminal)
				? { terminalId: options.terminal ?? ownTerminal }
				: {}),
		});
		return options.open ? todos.filter((todo) => !todo.done) : todos;
	},
});
