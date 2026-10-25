import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const NOTE_STATUSES = ["open", "kept", "dropped", "done"] as const;
export const NOTE_ACTORS = ["user", "agent"] as const;
/** A `context` note is pinned: every agent of the workspace gets it at start. */
export const NOTE_KINDS = ["note", "context"] as const;

export type NoteStatus = (typeof NOTE_STATUSES)[number];
/** Who acts on a note: the user in the app, or an agent through the CLI. */
export type NoteActor = (typeof NOTE_ACTORS)[number];
export type NoteKind = (typeof NOTE_KINDS)[number];

export interface WorkspaceNote {
	id: string;
	workspaceId: string;
	text: string;
	details: string | null;
	kind: NoteKind;
	status: NoteStatus;
	createdBy: NoteActor;
	createdAt: number;
	updatedAt: number;
}

export interface NoteFields {
	text?: string;
	details?: string | null;
	kind?: NoteKind;
}

export class NotePermissionError extends Error {}
export class NoteNotFoundError extends Error {}

export const MAX_WORKSPACES = 200;
export const MAX_NOTES_PER_WORKSPACE = 500;

interface NoteFile {
	version: 1;
	notes: WorkspaceNote[];
}

export function defaultNotesPath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "workspace-notes.json");
}

/**
 * Notes the user pins to a workspace, in one JSON file the app and the
 * agents' CLI both go through, like conversation to-dos. Agents may read
 * every note, add their own and mark any done, but only reword, triage or
 * delete their own: the user's notes are the user's to judge.
 */
export class WorkspaceNoteStore {
	private notes: WorkspaceNote[] | null = null;

	constructor(
		private readonly filePath: string = defaultNotesPath(),
		private readonly now: () => number = Date.now,
	) {}

	list(filter: { workspaceId?: string } = {}) {
		return this.load().filter(
			(note) => !filter.workspaceId || note.workspaceId === filter.workspaceId,
		);
	}

	add(input: {
		actor: NoteActor;
		workspaceId: string;
		items: Array<{ text: string; details?: string | null; kind?: NoteKind }>;
	}): WorkspaceNote[] {
		const items = input.items
			.map((item) => ({
				text: item.text.trim(),
				details: cleanDetails(item.details),
				kind: item.kind ?? "note",
			}))
			.filter((item) => item.text);
		if (items.length === 0) throw new Error("A note needs some text");
		const at = this.now();
		const added = items.map(
			(item): WorkspaceNote => ({
				id: randomUUID(),
				workspaceId: input.workspaceId,
				text: item.text,
				details: item.details,
				kind: item.kind,
				status: "open",
				createdBy: input.actor,
				createdAt: at,
				updatedAt: at,
			}),
		);
		this.save([...this.load(), ...added]);
		return added;
	}

	update(actor: NoteActor, id: string, fields: NoteFields): WorkspaceNote {
		const note = this.get(id);
		this.assertOwns(actor, note, "change");
		const text = fields.text?.trim();
		if (fields.text !== undefined && !text) {
			throw new Error("A note needs some text");
		}
		return this.replace({
			...note,
			...(text ? { text } : {}),
			...(fields.details !== undefined
				? { details: cleanDetails(fields.details) }
				: {}),
			...(fields.kind ? { kind: fields.kind } : {}),
		});
	}

	setStatus(actor: NoteActor, id: string, status: NoteStatus): WorkspaceNote {
		const note = this.get(id);
		if (status !== "done") this.assertOwns(actor, note, "triage");
		return this.replace({ ...note, status });
	}

	remove(actor: NoteActor, id: string): WorkspaceNote {
		const note = this.get(id);
		this.assertOwns(actor, note, "delete");
		this.save(this.load().filter((item) => item.id !== id));
		return note;
	}

	private assertOwns(
		actor: NoteActor,
		note: WorkspaceNote,
		action: string,
	): void {
		if (actor === "user" || note.createdBy === "agent") return;
		throw new NotePermissionError(
			`Agents can read the user's notes and mark them done, but not ${action} them`,
		);
	}

	private get(id: string): WorkspaceNote {
		const note = this.load().find((item) => item.id === id);
		if (!note) throw new NoteNotFoundError(`Note not found: ${id}`);
		return note;
	}

	private replace(note: WorkspaceNote): WorkspaceNote {
		const updated = { ...note, updatedAt: this.now() };
		this.save(
			this.load().map((item) => (item.id === note.id ? updated : item)),
		);
		return updated;
	}

	private load(): WorkspaceNote[] {
		if (this.notes) return this.notes;
		try {
			const file = JSON.parse(readFileSync(this.filePath, "utf8")) as NoteFile;
			// Notes saved before kinds existed are plain notes.
			this.notes = Array.isArray(file.notes)
				? file.notes.map((note) => ({ ...note, kind: note.kind ?? "note" }))
				: [];
		} catch {
			this.notes = [];
		}
		return this.notes;
	}

	private save(notes: WorkspaceNote[]): void {
		this.notes = bound(notes);
		mkdirSync(dirname(this.filePath), { recursive: true });
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		try {
			const file: NoteFile = { version: 1, notes: this.notes };
			writeFileSync(temporaryPath, JSON.stringify(file, null, "\t"));
			renameSync(temporaryPath, this.filePath);
		} catch (error) {
			try {
				unlinkSync(temporaryPath);
			} catch {
				// Best-effort cleanup after a failed write or rename.
			}
			throw error;
		}
	}
}

function cleanDetails(details: string | null | undefined): string | null {
	return details?.trim() || null;
}

// Deleted workspaces never come back, so once the cap is reached the
// workspace touched longest ago goes first.
function bound(notes: WorkspaceNote[]): WorkspaceNote[] {
	const byWorkspace = new Map<string, WorkspaceNote[]>();
	for (const note of notes) {
		const list = byWorkspace.get(note.workspaceId) ?? [];
		list.push(note);
		byWorkspace.set(note.workspaceId, list);
	}
	const lastTouched = (list: WorkspaceNote[]) =>
		Math.max(...list.map((note) => note.updatedAt));
	return [...byWorkspace.values()]
		.sort((a, b) => lastTouched(b) - lastTouched(a))
		.slice(0, MAX_WORKSPACES)
		.flatMap((list) => list.slice(-MAX_NOTES_PER_WORKSPACE));
}
