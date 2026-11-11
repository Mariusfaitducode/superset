import { expect, test } from "bun:test";
import { orderTodoSections } from "./orderTodoSections";

const conversations = [
	{ terminalId: "a" },
	{ terminalId: "b" },
	{ terminalId: "c" },
];
const todosByTerminal = new Map([
	["a", [{ id: 1, author: "user" }]],
	["b", [{ id: 2, author: "agent" }]],
]);

test("puts the focused conversation first, even without to-dos", () => {
	const sections = orderTodoSections({
		conversations,
		todosByTerminal,
		focusedTerminalId: "c",
		includeAgentTodos: true,
	});
	expect(sections.map((section) => section.conversation.terminalId)).toEqual([
		"c",
		"a",
		"b",
	]);
	expect(sections.map((section) => section.focused)).toEqual([
		true,
		false,
		false,
	]);
});

test("leaves out conversations whose only to-dos are hidden agent ones", () => {
	const sections = orderTodoSections({
		conversations,
		todosByTerminal,
		focusedTerminalId: null,
		includeAgentTodos: false,
	});
	expect(sections.map((section) => section.conversation.terminalId)).toEqual([
		"a",
	]);
});
