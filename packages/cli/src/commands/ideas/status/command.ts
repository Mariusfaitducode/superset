import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	IDEA_STATUSES,
	ideaActor,
	localIdeasClient,
	resolveIdeaId,
} from "../../../lib/ideas";

export default command({
	description:
		"Set an idea's status: open, kept, dropped or done. Agents can mark the user's ideas done, nothing else",
	args: [
		positional("id")
			.required()
			.desc("Idea ID, or the short ID from `ideas list`"),
		positional("status")
			.required()
			.enum(...IDEA_STATUSES)
			.desc("open, kept, dropped or done"),
	],
	run: async ({ ctx, args }) => {
		const client = await localIdeasClient(ctx);
		const id = resolveIdeaId(args.id as string, await client.list.query({}));
		const idea = await client.setStatus.mutate({
			actor: ideaActor(),
			id,
			status: args.status as (typeof IDEA_STATUSES)[number],
		});
		return { data: idea, message: `${idea.status}: ${idea.text}` };
	},
});
