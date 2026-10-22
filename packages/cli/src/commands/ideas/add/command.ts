import { positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	clearable,
	ideaActor,
	ideaWorkspace,
	localIdeasClient,
} from "../../../lib/ideas";

export default command({
	description: "Add an idea to this workspace",
	args: [positional("text").required().desc("The idea, in a short line")],
	options: {
		note: string().desc("More detail"),
		workspace: string().desc("Workspace ID (default: this terminal's)"),
	},
	run: async ({ ctx, args, options }) => {
		const note = clearable(options.note);
		const [idea] = await (await localIdeasClient(ctx)).add.mutate({
			actor: ideaActor(),
			workspaceId: ideaWorkspace(options.workspace ?? undefined),
			items: [{ text: args.text as string, ...(note ? { note } : {}) }],
		});
		return {
			data: idea,
			message: idea ? `Added ${idea.id.slice(0, 8)}: ${idea.text}` : "",
		};
	},
});
