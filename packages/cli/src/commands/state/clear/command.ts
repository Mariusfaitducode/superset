import { CLIError, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localHostClient } from "../../../lib/local-host";

export default command({
	description:
		"Remove a conversation's pinned state, back to the one the app infers",
	options: {
		terminal: string().desc("Terminal ID (default: this terminal)"),
	},
	run: async ({ ctx, options }) => {
		const terminalId = options.terminal ?? process.env.SUPERSET_TERMINAL_ID;
		if (!terminalId) {
			throw new CLIError(
				"No conversation to clear",
				"Run it from an agent's terminal, or pass --terminal.",
			);
		}
		const removed = await (
			await localHostClient(ctx)
		).conversationStates.clear.mutate({ terminalId });
		return {
			data: { removed },
			message: removed ? "Back to the inferred state" : "Nothing was pinned",
		};
	},
});
