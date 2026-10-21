import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localTodosClient, resolveTodoId, todoActor } from "../../../lib/todos";

export default command({
	description: "Check a to-do",
	args: [
		positional("id")
			.required()
			.desc("To-do ID, or the short ID from `todos list`"),
	],
	run: async ({ ctx, args }) => {
		const client = await localTodosClient(ctx);
		const id = resolveTodoId(args.id as string, await client.list.query({}));
		const todo = await client.setDone.mutate({
			actor: todoActor(),
			id,
			done: true,
		});
		return {
			data: todo,
			message: `${todo.done ? "Checked" : "Unchecked"} ${todo.text}`,
		};
	},
});
