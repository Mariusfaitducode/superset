import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import {
	localNotesClient,
	NOTE_STATUSES,
	noteActor,
	resolveNoteId,
} from "../../../lib/notes";

export default command({
	description:
		"Set a note's status: open, kept, dropped or done. Agents can mark the user's notes done, nothing else",
	args: [
		positional("id")
			.required()
			.desc("Note ID, or the short ID from `notes list`"),
		positional("status")
			.required()
			.enum(...NOTE_STATUSES)
			.desc("open, kept, dropped or done"),
	],
	run: async ({ ctx, args }) => {
		const client = await localNotesClient(ctx);
		const id = resolveNoteId(args.id as string, await client.list.query({}));
		const note = await client.setStatus.mutate({
			actor: noteActor(),
			id,
			status: args.status as (typeof NOTE_STATUSES)[number],
		});
		return { data: note, message: `${note.status}: ${note.text}` };
	},
});
