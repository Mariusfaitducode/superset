import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localTodosClient, resolveTodoId, todoActor } from "../../../lib/todos";

export default command({
	description:
		"Bring an archived to-do back to the list. Agents can only restore their own",
	args: [
		positional("id")
			.required()
			.desc("To-do ID, or the short ID from `todos list --archived`"),
	],
	run: async ({ ctx, args }) => {
		const client = await localTodosClient(ctx);
		const id = resolveTodoId(
			args.id as string,
			await client.list.query({ archived: true }),
			"Run: superset todos list --archived --all",
		);
		const todo = await client.restore.mutate({ actor: todoActor(), id });
		return { data: todo, message: `Restored ${todo.text}` };
	},
});
