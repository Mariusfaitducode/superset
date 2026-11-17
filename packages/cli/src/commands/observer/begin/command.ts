import { string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localHostClient } from "../../../lib/local-host";
import { todoConversation } from "../../../lib/todos";

export default command({
	description:
		"Mark the start of an observer run, so the Office shows it running. Run from the observer's terminal",
	options: {
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		terminal: string().desc("Terminal ID (default: this terminal)"),
	},
	run: async ({ ctx, options }) => {
		const run = await (await localHostClient(ctx)).officeObserver.begin.mutate(
			todoConversation({
				workspace: options.workspace ?? undefined,
				terminal: options.terminal ?? undefined,
			}),
		);
		return { data: run, message: `Observer run ${run.id.slice(0, 8)} started` };
	},
});
