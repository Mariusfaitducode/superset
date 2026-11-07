import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	localTracksClient,
	taskIdFrom,
	taskMessage,
	taskOption,
	trackTerminal,
} from "../../../lib/tracks";

export default command({
	description:
		"Mark the task failed, with the reason. The user gets a notification and the card turns red",
	args: [positional("reason").required().desc("Why it failed")],
	options: { ...taskOption },
	run: async ({ ctx, args, options }) => {
		const client = await localTracksClient(ctx);
		const task = await client.fail.mutate({
			terminalId: trackTerminal().terminalId,
			id: await taskIdFrom(client, options.task),
			reason: args.reason as string,
		});
		return { data: task, message: taskMessage("Failed", task) };
	},
});
