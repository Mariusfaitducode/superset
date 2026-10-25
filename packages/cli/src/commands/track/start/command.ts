import { number, positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	localTracksClient,
	parseSteps,
	taskMessage,
	trackTerminal,
} from "../../../lib/tracks";

export default command({
	description:
		"Start following a long task. Prints its ID; later `track` commands default to this conversation's latest running task",
	args: [positional("title").required().desc("What is being waited on")],
	options: {
		steps: string().desc('Comma-separated steps: "Snapshot,Purge logs,Check"'),
		link: string().desc(
			"A URL to follow: a GitHub Actions run or PR is followed by the host until it ends",
		),
		workflow: string().desc(
			'With a PR link, only this workflow\'s runs (e.g. "Fork CI"); default: all of them',
		),
		silentAfter: number()
			.int()
			.min(1)
			.desc(
				"Minutes without news before the card reads as silent (default 15)",
			),
	},
	run: async ({ ctx, args, options }) => {
		const task = await (await localTracksClient(ctx)).start.mutate({
			...trackTerminal(),
			title: args.title as string,
			...(parseSteps(options.steps)
				? { steps: parseSteps(options.steps) }
				: {}),
			...(options.link ? { link: options.link } : {}),
			...(options.workflow ? { workflow: options.workflow } : {}),
			...(options.silentAfter
				? { silenceAfterMinutes: options.silentAfter }
				: {}),
		});
		const followed = task.ci ? " (the host follows its CI)" : "";
		return {
			data: task,
			message: `${taskMessage("Started", task)}${followed}`,
		};
	},
});
