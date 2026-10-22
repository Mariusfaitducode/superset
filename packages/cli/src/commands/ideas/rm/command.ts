import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { ideaActor, localIdeasClient, resolveIdeaId } from "../../../lib/ideas";

export default command({
	description: "Delete an idea. Agents can only delete their own",
	args: [
		positional("id")
			.required()
			.desc("Idea ID, or the short ID from `ideas list`"),
	],
	run: async ({ ctx, args }) => {
		const client = await localIdeasClient(ctx);
		const id = resolveIdeaId(args.id as string, await client.list.query({}));
		await client.remove.mutate({ actor: ideaActor(), id });
		return { data: { id }, message: `Deleted ${id.slice(0, 8)}` };
	},
});
