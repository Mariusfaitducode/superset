import { string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localHostClient } from "../../../lib/local-host";
import { readSynthesis } from "../../../lib/observer";
import { todoConversation } from "../../../lib/todos";

export default command({
	description:
		"Publish the observer's synthesis to the Office: a headline and findings by mission, read from a JSON file",
	options: {
		file: string()
			.required()
			.desc(
				'JSON file: {"headline", "findings": [{"mission": "superset|work|efficiency", "priority"?: "high|normal", "title", "detail"?, "link"?, "workspaceId"?, "terminalId"?}], "file"?: "<the Markdown synthesis>"}',
			),
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		terminal: string().desc("Terminal ID (default: this terminal)"),
	},
	run: async ({ ctx, options }) => {
		const synthesis = readSynthesis(options.file);
		const run = await (
			await localHostClient(ctx)
		).officeObserver.publish.mutate({
			...todoConversation({
				workspace: options.workspace ?? undefined,
				terminal: options.terminal ?? undefined,
			}),
			headline: synthesis.headline,
			findings: synthesis.findings as never,
			file: synthesis.file ?? null,
		});
		return {
			data: run,
			message: `Published: ${run.synthesis?.headline} (${run.synthesis?.findings.length ?? 0} findings)`,
		};
	},
});
