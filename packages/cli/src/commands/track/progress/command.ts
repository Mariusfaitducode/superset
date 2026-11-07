import { CLIError, positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	localTracksClient,
	taskIdFrom,
	taskMessage,
	taskOption,
	trackTerminal,
} from "../../../lib/tracks";

export default command({
	description: "Report a percentage, 0 to 100",
	args: [positional("percent").required().desc("0 to 100")],
	options: {
		note: string().desc("A short note shown on the card"),
		...taskOption,
	},
	run: async ({ ctx, args, options }) => {
		const percent = Number(args.percent);
		if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
			throw new CLIError("Progress is a number from 0 to 100");
		}
		const client = await localTracksClient(ctx);
		const task = await client.progress.mutate({
			terminalId: trackTerminal().terminalId,
			id: await taskIdFrom(client, options.task),
			percent,
			...(options.note ? { note: options.note } : {}),
		});
		return {
			data: task,
			message: `${taskMessage("Progress", task)} → ${task.progress}%`,
		};
	},
});
