import { positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	clearable,
	localTodosClient,
	richFields,
	todoActor,
	todoConversation,
	todoFieldOptions,
} from "../../../lib/todos";

export default command({
	description: "Add a to-do to this conversation",
	args: [positional("text").required().desc("What needs doing")],
	options: {
		...todoFieldOptions,
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		terminal: string().desc("Terminal ID (default: this terminal)"),
	},
	run: async ({ ctx, args, options }) => {
		const due = clearable(options.due);
		const link = clearable(options.link);
		const todo = await (await localTodosClient(ctx)).add.mutate({
			actor: todoActor(),
			...todoConversation({
				workspace: options.workspace ?? undefined,
				terminal: options.terminal ?? undefined,
			}),
			text: args.text as string,
			...(options.priority ? { priority: options.priority } : {}),
			...(options.kind ? { kind: options.kind } : {}),
			...(due ? { dueOn: due } : {}),
			...(link ? { link } : {}),
			...richFields(options),
		});
		return {
			data: todo,
			message: `Added ${todo.id.slice(0, 8)}: ${todo.text}`,
		};
	},
});
