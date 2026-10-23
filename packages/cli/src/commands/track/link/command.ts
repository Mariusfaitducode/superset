import { positional, string } from "@superset/cli-framework";
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
		"Set the task's link, e.g. once the CI run exists. A GitHub Actions run or PR is then followed by the host",
	args: [
		positional("url").required().desc("The URL, or an empty string to clear"),
	],
	options: {
		workflow: string().desc("With a PR link, only this workflow's runs"),
		...taskOption,
	},
	run: async ({ ctx, args, options }) => {
		const client = await localTracksClient(ctx);
		const url = (args.url as string).trim();
		const task = await client.setLink.mutate({
			terminalId: trackTerminal().terminalId,
			id: await taskIdFrom(client, options.task),
			link: url || null,
			...(options.workflow ? { workflow: options.workflow } : {}),
		});
		const followed = task.ci ? " (the host follows its CI)" : "";
		return { data: task, message: `${taskMessage("Linked", task)}${followed}` };
	},
});
