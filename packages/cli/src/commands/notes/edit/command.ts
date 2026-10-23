import { CLIError, positional, string } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	clearable,
	localNotesClient,
	NOTE_KINDS,
	noteActor,
	resolveNoteId,
} from "../../../lib/notes";

export default command({
	description:
		"Change a note's text, details or kind. Agents can only change their own",
	args: [
		positional("id")
			.required()
			.desc("Note ID, or the short ID from `notes list`"),
	],
	options: {
		text: string().desc("New text"),
		details: string().desc("New details (empty to clear)"),
		kind: string()
			.enum(...NOTE_KINDS)
			.desc("context pins it for every agent here, note unpins it"),
	},
	run: async ({ ctx, args, options }) => {
		const fields = {
			...(options.text ? { text: options.text } : {}),
			...(options.details !== undefined
				? { details: clearable(options.details) }
				: {}),
			...(options.kind
				? { kind: options.kind as (typeof NOTE_KINDS)[number] }
				: {}),
		};
		if (Object.keys(fields).length === 0) {
			throw new CLIError(
				"Nothing to change",
				"Pass --text, --details or --kind.",
			);
		}
		const client = await localNotesClient(ctx);
		const id = resolveNoteId(args.id as string, await client.list.query({}));
		const note = await client.update.mutate({
			actor: noteActor(),
			id,
			...fields,
		});
		return { data: note, message: `Updated ${note.text}` };
	},
});
