import { describe, expect, test } from "bun:test";
import {
	type NoteStatus,
	parseNoteLines,
	sortNotes,
	type WorkspaceNote,
} from "./notes";

const note = (id: string, status: NoteStatus, createdAt: number) =>
	({ id, status, createdAt }) as WorkspaceNote;

describe("parseNoteLines", () => {
	test("makes one note per line, without bullets or numbers", () => {
		expect(
			parseNoteLines(
				"- Dark mode\r\n\n* Export CSV\n  1. Shortcuts\n2) Undo\n• Sync\n- [ ] Tags\n[x] Done one\nplain - with dash",
			),
		).toEqual([
			"Dark mode",
			"Export CSV",
			"Shortcuts",
			"Undo",
			"Sync",
			"Tags",
			"Done one",
			"plain - with dash",
		]);
	});

	test("keeps a number that is part of the note", () => {
		expect(parseNoteLines("3D preview\n2026 roadmap")).toEqual([
			"3D preview",
			"2026 roadmap",
		]);
	});
});

describe("sortNotes", () => {
	test("puts open and kept notes before closed ones, oldest first", () => {
		const sorted = sortNotes([
			note("done", "done", 1),
			note("kept", "kept", 3),
			note("open", "open", 2),
			note("dropped", "dropped", 0),
		]);
		expect(sorted.map((item) => item.id)).toEqual([
			"open",
			"kept",
			"dropped",
			"done",
		]);
	});
});
