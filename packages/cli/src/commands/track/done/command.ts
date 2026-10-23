import { string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	localTracksClient,
	taskIdFrom,
	taskMessage,
	taskOption,
	trackTerminal,
} from "../../../lib/tracks";

export default command({
	description: "Mark the task done. Its card stays until the user closes it",
	options: { note: string().desc("A closing note"), ...taskOption },
	run: async ({ ctx, options }) => {
		const client = await localTracksClient(ctx);
		const task = await client.done.mutate({
			terminalId: trackTerminal().terminalId,
			id: await taskIdFrom(client, options.task),
			...(options.note ? { note: options.note } : {}),
		});
		return { data: task, message: taskMessage("Done", task) };
	},
});
