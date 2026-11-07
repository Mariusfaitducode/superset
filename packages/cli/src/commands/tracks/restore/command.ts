import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	localTracksClient,
	resolveTaskId,
	taskMessage,
	trackActor,
} from "../../../lib/tracks";

export default command({
	description: "Bring an archived task's card back. Only the user can",
	args: [
		positional("id")
			.required()
			.desc("Task ID, or the short ID from `tracks list --archived`"),
	],
	run: async ({ ctx, args }) => {
		const client = await localTracksClient(ctx);
		const id = resolveTaskId(
			args.id as string,
			await client.list.query({ archived: true }),
			"Run: superset tracks list --archived --all",
		);
		const task = await client.restore.mutate({ actor: trackActor(), id });
		return { data: task, message: taskMessage("Restored", task) };
	},
});
