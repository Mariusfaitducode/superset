import { CLIError } from "@superset/cli-framework";
import type { CliContext } from "../command";
import type { HostServiceClient } from "../host-target";
import { localHostClient } from "../local-host";

export type Note = Awaited<
	ReturnType<HostServiceClient["workspaceNotes"]["list"]["query"]>
>[number];

export const NOTE_STATUSES = ["open", "kept", "dropped", "done"] as const;

/** The workspace the command runs in, unless the flag names another. */
export function noteWorkspace(
	flag: string | undefined,
	env: NodeJS.ProcessEnv = process.env,
): string {
	const workspaceId = flag ?? env.SUPERSET_WORKSPACE_ID;
	if (!workspaceId) {
		throw new CLIError(
			"No workspace to attach the note to",
			"Run it from a workspace's terminal, or pass --workspace.",
		);
	}
	return workspaceId;
}

/** Accepts the short id `notes list` prints, as long as it is unambiguous. */
export function resolveNoteId(idOrPrefix: string, notes: Note[]): string {
	const matches = notes.filter((note) => note.id.startsWith(idOrPrefix));
	if (matches.length === 1 && matches[0]) return matches[0].id;
	throw new CLIError(
		matches.length === 0
			? `Note not found: ${idOrPrefix}`
			: `Several notes start with ${idOrPrefix}`,
		"Run: superset notes list --all",
	);
}

export function noteRows(notes: Note[]) {
	return notes.map((note) => ({
		id: note.id.slice(0, 8),
		status: note.status,
		by: note.createdBy,
		text: note.details ? `${note.text} — ${note.details}` : note.text,
	}));
}

/** Notes live on the host of this machine, where the agents run. */
export async function localNotesClient(ctx: CliContext) {
	return (await localHostClient(ctx)).workspaceNotes;
}

// Same rule as to-dos: an agent's terminal acts as the agent.
export { clearable, todoActor as noteActor } from "../todos";
