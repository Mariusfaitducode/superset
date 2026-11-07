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
	description: "Add a note to the card; it also counts as news for silence",
	args: [positional("text").required().desc("The note")],
	options: { ...taskOption },
	run: async ({ ctx, args, options }) => {
		const client = await localTracksClient(ctx);
		const task = await client.note.mutate({
			terminalId: trackTerminal().terminalId,
			id: await taskIdFrom(client, options.task),
			text: args.text as string,
		});
		return { data: task, message: taskMessage("Noted on", task) };
	},
});
