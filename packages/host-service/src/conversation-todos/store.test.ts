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

	test("keeps agents from changing or deleting the user's to-dos", () => {
		const todo = store.add({ ...where, actor: "user", text: "Mine" });
		expect(() => store.update("agent", todo.id, { text: "Theirs" })).toThrow(
			TodoPermissionError,
		);
		expect(() => store.remove("agent", todo.id)).toThrow(TodoPermissionError);
		expect(store.list(where)[0]?.text).toBe("Mine");
	});

	test("lets agents change their own and the user change anything", () => {
		const own = store.add({ ...where, actor: "agent", text: "Plan" });
		expect(
			store.update("agent", own.id, { priority: "high", dueOn: "2026-10-30" }),
		).toMatchObject({ priority: "high", dueOn: "2026-10-30", text: "Plan" });
		expect(
			store.update("user", own.id, { link: null, kind: "code" }).kind,
		).toBe("code");
		store.remove("user", own.id);
		expect(store.list(where)).toEqual([]);
	});

	test("refuses blank text", () => {
		const todo = store.add({ ...where, actor: "user", text: "x" });
		expect(() => store.add({ ...where, actor: "user", text: "  " })).toThrow();
		expect(() => store.update("user", todo.id, { text: " " })).toThrow();
	});

	test("clears only the checked to-dos the actor may delete", () => {
		const userTodo = store.add({ ...where, actor: "user", text: "u" });
		const agentTodo = store.add({ ...where, actor: "agent", text: "a" });
		store.add({ ...where, actor: "agent", text: "open" });
		store.setDone("user", userTodo.id, true);
		store.setDone("user", agentTodo.id, true);
		expect(store.clearDone("agent", "term-1")).toBe(1);
		expect(store.list(where).map((todo) => todo.text)).toEqual(["u", "open"]);
		expect(store.clearDone("user", "term-1")).toBe(1);
	});

	test("caps a conversation's list, dropping the oldest", () => {
		for (let i = 0; i <= MAX_TODOS_PER_CONVERSATION; i++) {
			store.add({ ...where, actor: "agent", text: `t${i}` });
		}
		const list = store.list(where);
		expect(list).toHaveLength(MAX_TODOS_PER_CONVERSATION);
		expect(list[0]?.text).toBe("t1");
	});

	test("starts empty on a missing or broken file", () => {
		expect(new ConversationTodoStore(join(dir, "none.json")).list()).toEqual(
			[],
		);
	});

	test("keeps the rich fields of a to-do the user does by hand", () => {
		const todo = store.add({
			...where,
			actor: "agent",
			text: "Mail Paul the beta invite",
			kind: "mail",
			steps: [" Check the address ", "", "Send it"],
			draft: "  Hi Paul,\n\nHere is your invite.  ",
			recipient: " paul@example.com ",
			channel: "email",
		});
		expect(todo).toMatchObject({
			kind: "mail",
			steps: ["Check the address", "Send it"],
			draft: "Hi Paul,\n\nHere is your invite.",
			recipient: "paul@example.com",
			channel: "email",
		});
		const updated = store.update("agent", todo.id, {
			steps: [],
			draft: null,
			channel: " ",
			kind: "post",
		});
		expect(updated).toMatchObject({
			kind: "post",
			steps: [],
			draft: null,
			recipient: "paul@example.com",
			channel: null,
		});
		expect(new ConversationTodoStore(filePath).list(where)[0]).toEqual(updated);
	});

	test("defaults the rich fields to empty", () => {
		expect(store.add({ ...where, actor: "user", text: "x" })).toMatchObject({
			steps: [],
			draft: null,
			recipient: null,
			channel: null,
		});
	});

	test("refuses too many or too long steps", () => {
		expect(() =>
			store.add({
				...where,
				actor: "agent",
				text: "x",
				steps: Array.from({ length: 13 }, (_, i) => `s${i}`),
			}),
		).toThrow(/at most 12 steps/);
		expect(() =>
			store.add({
				...where,
				actor: "agent",
				text: "x",
				steps: ["a".repeat(301)],
			}),
		).toThrow();
	});

	test("reads a file written before the rich fields", () => {
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(
			filePath,
			JSON.stringify({
				version: 1,
				todos: [
					{
						id: "old",
						...where,
						text: "Old one",
						done: false,
						author: "user",
						doneBy: null,
						priority: "normal",
						kind: "review",
						dueOn: null,
						link: null,
						createdAt: 1,
						updatedAt: 1,
					},
				],
			}),
		);
		const old = new ConversationTodoStore(filePath);
		expect(old.list()[0]).toMatchObject({
			id: "old",
			kind: "review",
			steps: [],
			draft: null,
			recipient: null,
			channel: null,
		});
		expect(old.update("user", "old", { recipient: "Ana" }).recipient).toBe(
			"Ana",
		);
	});
});
