import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceLabelError, WorkspaceLabelStore } from "./store";

let dir: string;
let filePath: string;
let store: WorkspaceLabelStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "labels-"));
	filePath = join(dir, "state", "labels.json");
	store = new WorkspaceLabelStore(filePath);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("WorkspaceLabelStore", () => {
	test("starts with the default labels, ids kept across reloads", () => {
		const labels = store.list().labels;
		expect(labels.map((label) => label.name)).toEqual([
			"Waiting",
			"In progress",
			"Today",
			"Top priority",
		]);
		expect(new WorkspaceLabelStore(filePath).list().labels).toEqual(labels);
	});

	test("creates, renames and recolors a label, kept on disk", () => {
		const label = store.createLabel(" Review ", "violet");
		store.updateLabel(label.id, { name: "To review", color: "pink" });
		const reloaded = new WorkspaceLabelStore(filePath);
		expect(reloaded.findByName("to REVIEW")).toMatchObject({
			name: "To review",
			color: "pink",
		});
	});

	test("refuses a blank or duplicate name", () => {
		expect(() => store.createLabel(" ", "gray")).toThrow(WorkspaceLabelError);
		expect(() => store.createLabel("today", "gray")).toThrow(/already named/);
		const today = store.findByName("Today");
		expect(today && store.updateLabel(today.id, { name: "TODAY" }).name).toBe(
			"TODAY",
		);
	});

	test("sets a workspace's labels in label order, ignoring unknown ids", () => {
		const [waiting, , today] = store.list().labels;
		if (!waiting || !today) throw new Error("expected defaults");
		expect(
			store.setWorkspaceLabels("ws", [today.id, "nope", waiting.id]),
		).toEqual([waiting.id, today.id]);
		store.setWorkspaceLabels("ws", []);
		expect(store.list().assignments).toEqual({});
	});

	test("deleting a label takes it off every workspace", () => {
		const [waiting, progress] = store.list().labels;
		if (!waiting || !progress) throw new Error("expected defaults");
		store.setWorkspaceLabels("a", [waiting.id]);
		store.setWorkspaceLabels("b", [waiting.id, progress.id]);
		store.deleteLabel(waiting.id);
		expect(store.list().assignments).toEqual({ b: [progress.id] });
		expect(store.findByName("Waiting")).toBeUndefined();
	});
});
