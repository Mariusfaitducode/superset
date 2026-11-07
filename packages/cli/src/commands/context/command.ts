import { string } from "@superset/cli-framework";
import { command } from "../../lib/command";
import { formatContext } from "../../lib/context";
import { grantWorkspace } from "../../lib/grants";
import { localHostClient } from "../../lib/local-host";

async function orNull<T>(load: () => Promise<T>): Promise<T | null> {
	try {
		return await load();
	} catch {
		return null;
	}
}

export default command({
	description:
		"Print what an agent should know when it starts in this workspace: open to-dos, labels, grants and pinned context",
	options: {
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		terminal: string().desc("Conversation (terminal ID; default: this one)"),
	},
	run: async ({ ctx, options }) => {
		const client = await localHostClient(ctx);
		const workspaceId = grantWorkspace(options.workspace ?? undefined);
		const terminalId = options.terminal ?? process.env.SUPERSET_TERMINAL_ID;
		const [todos, labels, grants, notes] = await Promise.all([
			orNull(() =>
				client.conversationTodos.list.query({
					workspaceId,
					...(terminalId ? { terminalId } : {}),
				}),
			),
			orNull(async () => {
				const state = await client.workspaceLabels.list.query();
				const on = new Set(state.assignments[workspaceId] ?? []);
				return state.labels
					.filter((label) => on.has(label.id))
					.map((label) => label.name);
			}),
			orNull(() => client.workspaceGrants.list.query()),
			orNull(() => client.workspaceNotes.list.query({ workspaceId })),
		]);
		return {
			raw: formatContext({ workspaceId, todos, labels, grants, notes }),
		};
	},
});
