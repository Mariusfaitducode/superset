import { CLIError, positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	clearable,
	ideaActor,
	localIdeasClient,
	resolveIdeaId,
} from "../../../lib/ideas";

export default command({
	description:
		"Change an idea's text or note. Agents can only change their own",
	args: [
		positional("id")
			.required()
			.desc("Idea ID, or the short ID from `ideas list`"),
	],
	options: {
		text: string().desc("New text"),
		note: string().desc("New note (empty to clear)"),
	},
	run: async ({ ctx, args, options }) => {
		const fields = {
			...(options.text ? { text: options.text } : {}),
			...(options.note !== undefined ? { note: clearable(options.note) } : {}),
		};
		if (Object.keys(fields).length === 0) {
			throw new CLIError("Nothing to change", "Pass --text or --note.");
		}
		const client = await localIdeasClient(ctx);
		const id = resolveIdeaId(args.id as string, await client.list.query({}));
		const idea = await client.update.mutate({
			actor: ideaActor(),
			id,
			...fields,
		});
		return { data: idea, message: `Updated ${idea.text}` };
	},
});
