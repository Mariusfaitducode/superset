import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	ConversationTodoStore,
	MAX_ARCHIVED_PER_CONVERSATION,
	MAX_TODOS_PER_CONVERSATION,
	TodoPermissionError,
} from "./store";

let dir: string;
let filePath: string;
let clock: number;
let store: ConversationTodoStore;

const where = { workspaceId: "ws-1", terminalId: "term-1" };

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "todos-"));
	filePath = join(dir, "state", "todos.json");
	clock = 1_000;
	store = new ConversationTodoStore(filePath, () => clock++);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("ConversationTodoStore", () => {
	test("adds a to-do with defaults and keeps it on disk", () => {
		const todo = store.add({ ...where, actor: "user", text: "  Review #12 " });
		expect(todo).toMatchObject({
			text: "Review #12",
			author: "user",
			done: false,
			priority: "normal",
			kind: "other",
			dueOn: null,
			link: null,
		});
		const reloaded = new ConversationTodoStore(filePath);
		expect(reloaded.list(where).map((item) => item.id)).toEqual([todo.id]);
		expect(JSON.parse(readFileSync(filePath, "utf8")).version).toBe(1);
	});

	test("filters by workspace and conversation", () => {
		store.add({ ...where, actor: "user", text: "a" });
		store.add({
			workspaceId: "ws-1",
			terminalId: "term-2",
			actor: "user",
			text: "b",
		});
		store.add({
			workspaceId: "ws-2",
			terminalId: "term-3",
			actor: "user",
			text: "c",
		});
		expect(store.list({ workspaceId: "ws-1" })).toHaveLength(2);
		expect(store.list({ terminalId: "term-3" })[0]?.text).toBe("c");
		expect(store.list()).toHaveLength(3);
	});

	test("lets an agent check the user's to-do and records who did", () => {
		const todo = store.add({ ...where, actor: "user", text: "Ship it" });
		expect(store.setDone("agent", todo.id, true)).toMatchObject({
			done: true,
			doneBy: "agent",
		});
		expect(store.setDone("user", todo.id, false).doneBy).toBeNull();
	});

	test("keeps agents from changing or archiving the user's to-dos", () => {
		const todo = store.add({ ...where, actor: "user", text: "Mine" });
		expect(() => store.update("agent", todo.id, { text: "Theirs" })).toThrow(
			TodoPermissionError,
		);
		expect(() => store.archive("agent", todo.id)).toThrow(TodoPermissionError);
		expect(store.list(where)[0]?.text).toBe("Mine");
	});

	test("archives a to-do with who and when, out of the open list", () => {
		const todo = store.add({ ...where, actor: "agent", text: "Done soon" });
		const archived = store.archive("agent", todo.id);
		expect(archived).toMatchObject({ archivedBy: "agent" });
		expect(archived.archivedAt).toBeGreaterThan(todo.createdAt);
		expect(store.list(where)).toEqual([]);
		expect(store.list({ ...where, archived: true })).toMatchObject([
			{ id: todo.id, text: "Done soon" },
		]);
		const reloaded = new ConversationTodoStore(filePath);
		expect(reloaded.list({ archived: true })).toHaveLength(1);
	});

	test("restores an archived to-do, with the same ownership rule", () => {
		const userTodo = store.add({ ...where, actor: "user", text: "u" });
		store.archive("user", userTodo.id);
		expect(() => store.restore("agent", userTodo.id)).toThrow(
			TodoPermissionError,
		);
		expect(store.restore("user", userTodo.id)).toMatchObject({
			archivedAt: null,
			archivedBy: null,
		});
		expect(store.list(where)).toHaveLength(1);
	});

	test("reads to-dos written before archiving existed", () => {
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(
			filePath,
			JSON.stringify({
				version: 1,
				todos: [
					{
						id: "old",
						...where,
						text: "From an older host",
						done: false,
						author: "user",
						doneBy: null,
						priority: "normal",
						kind: "other",
						dueOn: null,
						link: null,
						createdAt: 1,
						updatedAt: 1,
					},
				],
			}),
		);
		const old = new ConversationTodoStore(filePath, () => clock++);
		expect(old.list(where).map((todo) => todo.id)).toEqual(["old"]);
		old.archive("user", "old");
		expect(old.list({ archived: true }).map((todo) => todo.id)).toEqual([
			"old",
		]);
	});

	test("lets agents change their own and the user change anything", () => {
		const own = store.add({ ...where, actor: "agent", text: "Plan" });
		expect(
			store.update("agent", own.id, { priority: "high", dueOn: "2026-10-30" }),
		).toMatchObject({ priority: "high", dueOn: "2026-10-30", text: "Plan" });
		expect(
			store.update("user", own.id, { link: null, kind: "code" }).kind,
		).toBe("code");
		store.archive("user", own.id);
		expect(store.list(where)).toEqual([]);
	});

	test("refuses blank text", () => {
		const todo = store.add({ ...where, actor: "user", text: "x" });
		expect(() => store.add({ ...where, actor: "user", text: "  " })).toThrow();
		expect(() => store.update("user", todo.id, { text: " " })).toThrow();
	});

	test("clears only the checked to-dos the actor may archive", () => {
		const userTodo = store.add({ ...where, actor: "user", text: "u" });
		const agentTodo = store.add({ ...where, actor: "agent", text: "a" });
		store.add({ ...where, actor: "agent", text: "open" });
		store.setDone("user", userTodo.id, true);
		store.setDone("user", agentTodo.id, true);
		expect(store.clearDone("agent", "term-1")).toBe(1);
		expect(store.list(where).map((todo) => todo.text)).toEqual(["u", "open"]);
		expect(store.clearDone("user", "term-1")).toBe(1);
		expect(
			store.list({ ...where, archived: true }).map((todo) => todo.text),
		).toEqual(["u", "a"]);
	});

	test("caps a conversation's list, dropping the oldest", () => {
		for (let i = 0; i <= MAX_TODOS_PER_CONVERSATION; i++) {
			store.add({ ...where, actor: "agent", text: `t${i}` });
		}
		const list = store.list(where);
		expect(list).toHaveLength(MAX_TODOS_PER_CONVERSATION);
		expect(list[0]?.text).toBe("t1");
	});

	test("caps archived to-dos apart, so they never push open ones out", () => {
		const open = store.add({ ...where, actor: "agent", text: "open" });
		for (let i = 0; i <= MAX_ARCHIVED_PER_CONVERSATION; i++) {
			const todo = store.add({ ...where, actor: "agent", text: `a${i}` });
			store.archive("agent", todo.id);
		}
		expect(store.list(where).map((todo) => todo.id)).toEqual([open.id]);
		const archived = store.list({ ...where, archived: true });
		expect(archived).toHaveLength(MAX_ARCHIVED_PER_CONVERSATION);
		expect(archived[0]?.text).toBe("a1");
	});

	test("starts empty on a missing or broken file", () => {
		expect(new ConversationTodoStore(join(dir, "none.json")).list()).toEqual(
			[],
		);
	});
});
