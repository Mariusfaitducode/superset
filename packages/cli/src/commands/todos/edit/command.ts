import { CLIError, positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	clearable,
	localTodosClient,
	resolveTodoId,
	richFields,
	todoActor,
	todoFieldOptions,
} from "../../../lib/todos";

export default command({
	description:
		"Change a to-do. Agents can only change their own; the user's they can only check",
	args: [
		positional("id")
			.required()
			.desc("To-do ID, or the short ID from `todos list`"),
	],
	options: { text: string().desc("New text"), ...todoFieldOptions },
	run: async ({ ctx, args, options }) => {
		const fields = {
			...(options.text ? { text: options.text } : {}),
			...(options.priority ? { priority: options.priority } : {}),
			...(options.kind ? { kind: options.kind } : {}),
			...(options.due !== undefined ? { dueOn: clearable(options.due) } : {}),
			...(options.link !== undefined ? { link: clearable(options.link) } : {}),
			...richFields(options),
		};
		if (Object.keys(fields).length === 0) {
			throw new CLIError(
				"Nothing to change",
				"Pass --text, --priority, --kind, --due, --link, --step, --draft, --recipient or --channel.",
			);
		}
		const client = await localTodosClient(ctx);
		const id = resolveTodoId(args.id as string, await client.list.query({}));
		const todo = await client.update.mutate({
			actor: todoActor(),
			id,
			...fields,
		});
		return { data: todo, message: `Updated ${todo.text}` };
	},
});
