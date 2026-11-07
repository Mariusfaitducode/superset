import { boolean, positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	clearable,
	localNotesClient,
	noteActor,
	noteWorkspace,
} from "../../../lib/notes";

export default command({
	description:
		"Add a note to this workspace. --context pins it: every agent started here gets it",
	args: [positional("text").required().desc("The note, in a short line")],
	options: {
		details: string().desc("More detail"),
		context: boolean().desc(
			"Pinned context (a brief, a decision): every agent here gets it at start",
		),
		workspace: string().desc("Workspace ID (default: this terminal's)"),
	},
	run: async ({ ctx, args, options }) => {
		const details = clearable(options.details);
		const [note] = await (await localNotesClient(ctx)).add.mutate({
			actor: noteActor(),
			workspaceId: noteWorkspace(options.workspace ?? undefined),
			items: [
				{
					text: args.text as string,
					...(details ? { details } : {}),
					...(options.context ? { kind: "context" as const } : {}),
				},
			],
		});
		return {
			data: note,
			message: note ? `Added ${note.id.slice(0, 8)}: ${note.text}` : "",
		};
	},
});
