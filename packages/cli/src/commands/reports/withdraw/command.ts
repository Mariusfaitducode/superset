import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localReportsClient, resolveReportId } from "../../../lib/reports";
import { todoActor } from "../../../lib/todos";

export default command({
	description:
		"Withdraw an open report that no longer needs the user, for example once they answered in the chat",
	args: [
		positional("id")
			.required()
			.desc("Report ID, or the short ID from `reports list`"),
	],
	run: async ({ ctx, args }) => {
		const client = await localReportsClient(ctx);
		const id = resolveReportId(args.id as string, await client.list.query({}));
		const report = await client.dismiss.mutate({ actor: todoActor(), id });
		return {
			data: report,
			message: `Withdrew ${id.slice(0, 8)}: ${report.summary}`,
		};
	},
});
