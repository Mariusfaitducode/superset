import { positional, string } from "@superset/cli-framework";
import { command } from "../../lib/command";
import {
	DRAFT_TARGETS,
	localReportsClient,
	REPORT_KINDS,
	readDraft,
} from "../../lib/reports";
import { todoActor, todoConversation } from "../../lib/todos";

export default command({
	description:
		"Hand work over to the user: it lands on their Desk. A new report closes this conversation's previous open one of the same kind",
	args: [
		positional("kind")
			.required()
			.enum(...REPORT_KINDS)
			.desc("done, decision, draft, blocked or progress"),
		positional("summary").required().desc("One line the user reads first"),
	],
	options: {
		details: string().desc("More context, in a few lines"),
		link: string().variadic().desc("A URL: PR, CI run, page. Repeatable"),
		checks: string().desc("What ran and the result"),
		test: string().desc("What the user should try"),
		option: string()
			.variadic()
			.desc("A choice for a decision, in order. Repeatable, 9 at most"),
		draftFile: string().desc("File holding the exact text of a draft"),
		target: string()
			.enum(...DRAFT_TARGETS)
			.desc("Where a draft goes: slack, github, notion or email"),
		workspace: string().desc("Workspace ID (default: this terminal's)"),
		terminal: string().desc("Terminal ID (default: this terminal)"),
	},
	run: async ({ ctx, args, options }) => {
		const kind = args.kind as (typeof REPORT_KINDS)[number];
		const draft = readDraft(kind, {
			draftFile: options.draftFile ?? undefined,
			target: options.target ?? undefined,
		});
		const report = await (await localReportsClient(ctx)).create.mutate({
			actor: todoActor(),
			...todoConversation({
				workspace: options.workspace ?? undefined,
				terminal: options.terminal ?? undefined,
			}),
			kind,
			summary: args.summary as string,
			...(options.details ? { details: options.details } : {}),
			...(options.link?.length ? { links: options.link } : {}),
			...(options.checks ? { checks: options.checks } : {}),
			...(options.test ? { test: options.test } : {}),
			...(options.option?.length ? { options: options.option } : {}),
			...(draft ? { draft } : {}),
		});
		return {
			data: report,
			message: `Reported ${report.kind} ${report.id.slice(0, 8)}: ${report.summary}`,
		};
	},
});
