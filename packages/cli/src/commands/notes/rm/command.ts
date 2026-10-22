import { positional } from "@superset/cli-framework";
import { command } from "../../../lib/command";
import { localNotesClient, noteActor, resolveNoteId } from "../../../lib/notes";

export default command({
	description: "Delete a note. Agents can only delete their own",
	args: [
		positional("id")
			.required()
			.desc("Note ID, or the short ID from `notes list`"),
	],
	run: async ({ ctx, args }) => {
		const client = await localNotesClient(ctx);
		const id = resolveNoteId(args.id as string, await client.list.query({}));
		await client.remove.mutate({ actor: noteActor(), id });
		return { data: { id }, message: `Deleted ${id.slice(0, 8)}` };
	},
});
