import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localTodosClient, resolveTodoId, todoActor } from "../../../lib/todos";

export default command({
	description: "Delete a to-do. Agents can only delete their own",
	args: [
		positional("id")
			.required()
			.desc("To-do ID, or the short ID from `todos list`"),
	],
	run: async ({ ctx, args }) => {
		const client = await localTodosClient(ctx);
		const id = resolveTodoId(args.id as string, await client.list.query({}));
		await client.remove.mutate({ actor: todoActor(), id });
		return { data: { id }, message: `Deleted ${id.slice(0, 8)}` };
	},
});
