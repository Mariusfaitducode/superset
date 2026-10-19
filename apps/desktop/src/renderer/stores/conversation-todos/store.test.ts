import { beforeEach, describe, expect, test } from "bun:test";
import { useConversationTodosStore } from "./store";

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
});
