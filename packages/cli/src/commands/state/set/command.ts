import { positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localHostClient } from "../../../lib/local-host";
import { todoActor, todoConversation } from "../../../lib/todos";

const STATES = ["waiting", "resume", "todos", "done"] as const;

export default command({
	description:
		"Pin a conversation's state until its next prompt: waiting (for the user's answer), resume (later), todos (resume with its to-do list) or done (can be closed)",
	args: [
		positional("state")
			.required()
			.enum(...STATES)
			.desc("waiting, resume, todos or done"),
	],
	options: {
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		terminal: string().desc("Terminal ID (default: this terminal)"),
	},
	run: async ({ ctx, args, options }) => {
		const mark = await (
			await localHostClient(ctx)
		).conversationStates.set.mutate({
			actor: todoActor(),
			...todoConversation({
				workspace: options.workspace ?? undefined,
				terminal: options.terminal ?? undefined,
			}),
			state: args.state as (typeof STATES)[number],
		});
		return { data: mark, message: `Pinned ${mark.state}` };
	},
});
