import { positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { changeGrants } from "../../../lib/grants";

export default command({
	description:
		"Grant this workspace's agents more permissions (user or coordinator only)",
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
			granted: true,
		}),
});
