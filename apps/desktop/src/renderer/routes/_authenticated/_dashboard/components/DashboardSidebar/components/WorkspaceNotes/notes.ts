import { toast } from "@superset/ui/sonner";
import type { HostServiceClient } from "renderer/lib/host-service-client";

export type WorkspaceNote = Awaited<
	ReturnType<HostServiceClient["workspaceNotes"]["list"]["query"]>
>[number];
export type NoteStatus = WorkspaceNote["status"];

export const NOTE_STATUSES: NoteStatus[] = ["open", "kept", "dropped", "done"];

const BULLET = /^(?:[-*+•]|\d+[.)])\s+/;
const CHECKBOX = /^\[[ xX]\]\s+/;

/** One note per pasted line, without list bullets, numbers or checkboxes. */
export function parseNoteLines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim().replace(BULLET, "").replace(CHECKBOX, "").trim())
		.filter(Boolean);
}

/** Still to decide or to do: what the row counts and "Open" shows. */
export function isActiveNote(note: WorkspaceNote): boolean {
	return note.status === "open" || note.status === "kept";
}

/** Active notes first, then the closed ones; oldest first within each. */
export function sortNotes(notes: WorkspaceNote[]): WorkspaceNote[] {
	return [...notes].sort(
		(a, b) =>
			Number(isActiveNote(b)) - Number(isActiveNote(a)) ||
			a.createdAt - b.createdAt,
	);
}

export function reportNoteError(promise: Promise<unknown>, message: string) {
	promise.catch((error: unknown) =>
		toast.error(message, {
			description: error instanceof Error ? error.message : undefined,
		}),
	);
}
