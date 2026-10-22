import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	IdeaPermissionError,
	MAX_IDEAS_PER_WORKSPACE,
	WorkspaceIdeaStore,
} from "./store";

let dir: string;
let filePath: string;
let clock: number;
let store: WorkspaceIdeaStore;

const workspaceId = "ws-1";

function addOne(actor: "user" | "agent", text: string) {
	const [idea] = store.add({ actor, workspaceId, items: [{ text }] });
	if (!idea) throw new Error("not added");
	return idea;
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "ideas-"));
	filePath = join(dir, "state", "ideas.json");
	clock = 1_000;
	store = new WorkspaceIdeaStore(filePath, () => clock++);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("WorkspaceIdeaStore", () => {
	test("adds several ideas at once, open, and keeps them on disk", () => {
		const added = store.add({
			actor: "user",
			workspaceId,
			items: [
				{ text: " Dark mode " },
				{ text: "  " },
				{ text: "Export", note: " CSV " },
			],
		});
		expect(added.map((idea) => [idea.text, idea.note, idea.status])).toEqual([
			["Dark mode", null, "open"],
			["Export", "CSV", "open"],
		]);
		const reloaded = new WorkspaceIdeaStore(filePath);
		expect(reloaded.list({ workspaceId })).toHaveLength(2);
		expect(JSON.parse(readFileSync(filePath, "utf8")).version).toBe(1);
	});

	test("filters by workspace", () => {
		addOne("user", "a");
		store.add({ actor: "user", workspaceId: "ws-2", items: [{ text: "b" }] });
		expect(store.list({ workspaceId: "ws-2" })[0]?.text).toBe("b");
		expect(store.list()).toHaveLength(2);
	});

	test("lets an agent mark the user's idea done but nothing else", () => {
		const idea = addOne("user", "Mine");
		expect(store.setStatus("agent", idea.id, "done").status).toBe("done");
		expect(() => store.setStatus("agent", idea.id, "dropped")).toThrow(
			IdeaPermissionError,
		);
		expect(() => store.update("agent", idea.id, { text: "x" })).toThrow(
			IdeaPermissionError,
		);
		expect(() => store.remove("agent", idea.id)).toThrow(IdeaPermissionError);
	});

	test("lets agents change their own and the user change anything", () => {
		const own = addOne("agent", "Plan");
		expect(store.update("agent", own.id, { note: "why" }).note).toBe("why");
		expect(store.setStatus("agent", own.id, "kept").status).toBe("kept");
		expect(store.update("user", own.id, { note: " " }).note).toBeNull();
		store.remove("user", own.id);
		expect(store.list()).toEqual([]);
	});

	test("refuses blank text", () => {
		const idea = addOne("user", "x");
		expect(() =>
			store.add({ actor: "user", workspaceId, items: [{ text: " " }] }),
		).toThrow();
		expect(() => store.update("user", idea.id, { text: " " })).toThrow();
	});

	test("caps a workspace's list, dropping the oldest", () => {
		store.add({
			actor: "user",
			workspaceId,
			items: Array.from({ length: MAX_IDEAS_PER_WORKSPACE + 1 }, (_, i) => ({
				text: `i${i}`,
			})),
		});
		const list = store.list({ workspaceId });
		expect(list).toHaveLength(MAX_IDEAS_PER_WORKSPACE);
		expect(list[0]?.text).toBe("i1");
	});

	test("starts empty on a missing file", () => {
		expect(new WorkspaceIdeaStore(join(dir, "none.json")).list()).toEqual([]);
	});
});
