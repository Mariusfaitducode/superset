import { describe, expect, test } from "bun:test";
import type { WorkspaceNote } from "../../../components/DashboardSidebar/components/WorkspaceNotes/notes";
import { buildNoteGroups, type NotesWorkspace } from "./noteGroups";

const workspace = (id: string, name: string): NotesWorkspace => ({
	id,
	hostId: "host",
	name,
	branch: id,
});

const note = (
	id: string,
	workspaceId: string,
	fields: Partial<WorkspaceNote> = {},
): WorkspaceNote => ({
	id,
	workspaceId,
	text: id,
	details: null,
	kind: "note",
	status: "open",
	createdBy: "user",
	createdAt: 1,
	updatedAt: 1,
	...fields,
});

const workspaces = [workspace("a", "Alpha"), workspace("b", "Beta")];
const notes = [
	note("a1", "a", { updatedAt: 5 }),
	note("a2", "a", { status: "done", text: "Ship the export" }),
	note("b1", "b", { updatedAt: 9, details: "export as CSV" }),
	note("gone", "deleted-workspace", { updatedAt: 99 }),
];

describe("buildNoteGroups", () => {
	test("groups open notes by workspace, latest touched first", () => {
		const result = buildNoteGroups(workspaces, notes, {
			status: "open",
			workspaceId: null,
			search: "",
		});
		expect(
			result.groups.map((group) => [
				group.workspace.id,
				group.notes.map((n) => n.id),
			]),
		).toEqual([
			["b", ["b1"]],
			["a", ["a1"]],
		]);
		expect(result.counts).toEqual({ open: 2, all: 3 });
	});

	test("leaves out notes of workspaces the app does not list", () => {
		const result = buildNoteGroups(workspaces, notes, {
			status: "all",
			workspaceId: null,
			search: "",
		});
		expect(result.workspaceOptions).toEqual([
			{ workspaceId: "a", name: "Alpha", count: 1 },
			{ workspaceId: "b", name: "Beta", count: 1 },
		]);
		expect(result.groups.flatMap((group) => group.notes)).toHaveLength(3);
	});

	test("searches text and details, case-insensitively", () => {
		const result = buildNoteGroups(workspaces, notes, {
			status: "all",
			workspaceId: null,
			search: " EXPORT ",
		});
		expect(
			result.groups.flatMap((group) => group.notes.map((n) => n.id)),
		).toEqual(["b1", "a2"]);
		expect(result.counts).toEqual({ open: 1, all: 2 });
	});

	test("keeps one workspace, and still offers the others", () => {
		const result = buildNoteGroups(workspaces, notes, {
			status: "all",
			workspaceId: "a",
			search: "",
		});
		expect(result.groups.map((group) => group.workspace.id)).toEqual(["a"]);
		expect(result.workspaceOptions).toHaveLength(2);
	});
});
