import { positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { changeGrants } from "../../../lib/grants";

export default command({
	description: "Take permissions back from this workspace's agents",
	args: [
		positional("grants")
			.variadic()
			.required()
			.desc("Grant ids, e.g. push-own-branch open-draft-pr"),
	],
	options: {
		workspace: string().desc("Workspace ID (default: this terminal's)"),
	},
	run: ({ ctx, args, options }) =>
		changeGrants(ctx, {
			workspace: options.workspace ?? undefined,
			names: args.grants as string[],
			granted: false,
		}),
});
