import { string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localHostClient } from "../../../lib/local-host";
import { todoReport } from "../../../lib/todos";

export default command({
	description:
		"Print a Markdown brief of the open to-dos of every conversation on this machine, with steps, recipients and drafts",
	options: {
		workspace: string().desc("Only this workspace's conversations"),
		terminal: string().desc("Only this conversation (terminal ID)"),
	},
	run: async ({ ctx, options }) => {
		const host = await localHostClient(ctx);
		const todos = await host.conversationTodos.list.query({
			...(options.workspace ? { workspaceId: options.workspace } : {}),
			...(options.terminal ? { terminalId: options.terminal } : {}),
		});
		// Names make the brief readable; ids still do if the list fails.
		const names = new Map<string, string>();
		try {
			for (const workspace of await host.workspace.list.query()) {
				names.set(workspace.id, workspace.name);
			}
		} catch {}
		return { raw: todoReport(todos, names) };
	},
});
