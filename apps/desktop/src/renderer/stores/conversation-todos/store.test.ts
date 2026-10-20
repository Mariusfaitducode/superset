import { beforeEach, describe, expect, test } from "bun:test";
import {
	MAX_CONVERSATIONS,
	MAX_TODOS_PER_CONVERSATION,
	useConversationTodosStore,
} from "./store";

const T = "terminal-1";
const store = () => useConversationTodosStore.getState();
const todos = () => store().todosByConversation[T] ?? [];

describe("conversation todos", () => {
	beforeEach(() => {
		useConversationTodosStore.setState({ todosByConversation: {} });
	});

	test("adds trimmed todos in order and ignores blank ones", () => {
		store().addTodo(T, "  relancer PB ");
		store().addTodo(T, "   ");
		store().addTodo(T, "tester sur le banc");
		expect(todos().map((todo) => todo.text)).toEqual([
			"relancer PB",
			"tester sur le banc",
		]);
		expect(todos().every((todo) => !todo.done)).toBe(true);
	});

	test("toggles a todo on and off", () => {
		store().addTodo(T, "relire");
		const id = todos()[0].id;
		store().toggleTodo(T, id);
		expect(todos()[0].done).toBe(true);
		store().toggleTodo(T, id);
		expect(todos()[0].done).toBe(false);
	});

	test("edits a todo, and an edit to blank removes it", () => {
		store().addTodo(T, "relire");
		const id = todos()[0].id;
		store().editTodo(T, id, " relire avant merge ");
		expect(todos()[0].text).toBe("relire avant merge");
		store().editTodo(T, id, "  ");
		expect(todos()).toEqual([]);
	});

	test("removes one todo", () => {
		store().addTodo(T, "a");
		store().addTodo(T, "b");
		store().removeTodo(T, todos()[0].id);
		expect(todos().map((todo) => todo.text)).toEqual(["b"]);
	});

	test("clearing removes only the done todos", () => {
		store().addTodo(T, "a");
		store().addTodo(T, "b");
		store().toggleTodo(T, todos()[0].id);
		store().clearDone(T);
		expect(todos().map((todo) => todo.text)).toEqual(["b"]);
	});

	test("a conversation with nothing left drops its key", () => {
		store().addTodo(T, "a");
		store().removeTodo(T, todos()[0].id);
		expect(T in store().todosByConversation).toBe(false);
	});

	test("conversations keep separate lists", () => {
		store().addTodo(T, "a");
		store().addTodo("terminal-2", "b");
		expect(todos().map((todo) => todo.text)).toEqual(["a"]);
	});

	test("keeps the most recently touched conversations within the cap", () => {
		const conversations = Object.fromEntries(
			Array.from({ length: MAX_CONVERSATIONS }, (_, index) => [
				`old-${index}`,
				[{ id: `${index}`, text: "a", done: false, createdAt: index }],
			]),
		);
		useConversationTodosStore.setState({ todosByConversation: conversations });
		store().addTodo(T, "new");
		const kept = store().todosByConversation;
		expect(Object.keys(kept)).toHaveLength(MAX_CONVERSATIONS);
		expect("old-0" in kept).toBe(false);
		expect(T in kept).toBe(true);
	});

	test("keeps the newest todos of a conversation within the cap", () => {
		for (let index = 0; index <= MAX_TODOS_PER_CONVERSATION; index += 1) {
			store().addTodo(T, `todo ${index}`);
		}
		expect(todos()).toHaveLength(MAX_TODOS_PER_CONVERSATION);
		expect(todos()[0].text).toBe("todo 1");
	});
});
