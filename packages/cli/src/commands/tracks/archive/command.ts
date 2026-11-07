import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	localTracksClient,
	resolveTaskId,
	taskMessage,
	trackActor,
} from "../../../lib/tracks";

export default command({
	description:
		"Close a task's card: it is archived, not deleted. Only the user can, agents are refused",
	args: [
		positional("id")
			.required()
			.desc("Task ID, or the short ID from `tracks list`"),
	],
	run: async ({ ctx, args }) => {
		const client = await localTracksClient(ctx);
		const id = resolveTaskId(args.id as string, await client.list.query({}));
		const task = await client.archive.mutate({ actor: trackActor(), id });
		return { data: task, message: taskMessage("Archived", task) };
	},
});
