import { positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	localTracksClient,
	parseStep,
	taskIdFrom,
	taskMessage,
	taskOption,
	trackTerminal,
} from "../../../lib/tracks";

export default command({
	description: "Move to a step; the steps before it count as done",
	args: [positional("step").required().desc("Step number (from 1) or name")],
	options: {
		note: string().desc("A short note shown on the card"),
		...taskOption,
	},
	run: async ({ ctx, args, options }) => {
		const client = await localTracksClient(ctx);
		const task = await client.step.mutate({
			terminalId: trackTerminal().terminalId,
			id: await taskIdFrom(client, options.task),
			step: parseStep(args.step as string),
			...(options.note ? { note: options.note } : {}),
		});
		const step = task.steps[task.currentStep ?? 0] ?? "";
		return { data: task, message: `${taskMessage("Step", task)} → ${step}` };
	},
});
