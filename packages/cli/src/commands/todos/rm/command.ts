import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localTodosClient, resolveTodoId, todoActor } from "../../../lib/todos";

export default command({
	description:
		"Archive a to-do: it leaves the list but is kept (`todos list --archived`, `todos restore`). Agents can only archive their own",
	args: [
		positional("id")
			.required()
			.desc("To-do ID, or the short ID from `todos list`"),
	],
	run: async ({ ctx, args }) => {
		const client = await localTodosClient(ctx);
		const id = resolveTodoId(args.id as string, await client.list.query({}));
		const todo = await client.archive.mutate({ actor: todoActor(), id });
		return { data: todo, message: `Archived ${todo.text}` };
	},
});
