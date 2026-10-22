import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	MAX_NOTES_PER_WORKSPACE,
	NotePermissionError,
	WorkspaceNoteStore,
} from "./store";

let dir: string;
let filePath: string;
let clock: number;
let store: WorkspaceNoteStore;

const workspaceId = "ws-1";

function addOne(actor: "user" | "agent", text: string) {
	const [note] = store.add({ actor, workspaceId, items: [{ text }] });
	if (!note) throw new Error("not added");
	return note;
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "notes-"));
	filePath = join(dir, "state", "notes.json");
	clock = 1_000;
	store = new WorkspaceNoteStore(filePath, () => clock++);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("WorkspaceNoteStore", () => {
	test("adds several notes at once, open, and keeps them on disk", () => {
		const added = store.add({
			actor: "user",
			workspaceId,
			items: [
				{ text: " Dark mode " },
				{ text: "  " },
				{ text: "Export", details: " CSV " },
			],
		});
		expect(added.map((note) => [note.text, note.details, note.status])).toEqual(
			[
				["Dark mode", null, "open"],
				["Export", "CSV", "open"],
			],
		);
		const reloaded = new WorkspaceNoteStore(filePath);
		expect(reloaded.list({ workspaceId })).toHaveLength(2);
		expect(JSON.parse(readFileSync(filePath, "utf8")).version).toBe(1);
	});

	test("filters by workspace", () => {
		addOne("user", "a");
		store.add({ actor: "user", workspaceId: "ws-2", items: [{ text: "b" }] });
		expect(store.list({ workspaceId: "ws-2" })[0]?.text).toBe("b");
		expect(store.list()).toHaveLength(2);
	});

	test("lets an agent mark the user's note done but nothing else", () => {
		const note = addOne("user", "Mine");
		expect(store.setStatus("agent", note.id, "done").status).toBe("done");
		expect(() => store.setStatus("agent", note.id, "dropped")).toThrow(
			NotePermissionError,
		);
		expect(() => store.update("agent", note.id, { text: "x" })).toThrow(
			NotePermissionError,
		);
		expect(() => store.remove("agent", note.id)).toThrow(NotePermissionError);
	});

	test("lets agents change their own and the user change anything", () => {
		const own = addOne("agent", "Plan");
		expect(store.update("agent", own.id, { details: "why" }).details).toBe(
			"why",
		);
		expect(store.setStatus("agent", own.id, "kept").status).toBe("kept");
		expect(store.update("user", own.id, { details: " " }).details).toBeNull();
		store.remove("user", own.id);
		expect(store.list()).toEqual([]);
	});

	test("refuses blank text", () => {
		const note = addOne("user", "x");
		expect(() =>
			store.add({ actor: "user", workspaceId, items: [{ text: " " }] }),
		).toThrow();
		expect(() => store.update("user", note.id, { text: " " })).toThrow();
	});

	test("caps a workspace's list, dropping the oldest", () => {
		store.add({
			actor: "user",
			workspaceId,
			items: Array.from({ length: MAX_NOTES_PER_WORKSPACE + 1 }, (_, i) => ({
				text: `i${i}`,
			})),
		});
		const list = store.list({ workspaceId });
		expect(list).toHaveLength(MAX_NOTES_PER_WORKSPACE);
		expect(list[0]?.text).toBe("i1");
	});

	test("starts empty on a missing file", () => {
		expect(new WorkspaceNoteStore(join(dir, "none.json")).list()).toEqual([]);
	});
});
