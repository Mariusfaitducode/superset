import { describe, expect, test } from "bun:test";
import {
	clearable,
	resolveTodoId,
	type Todo,
	todoActor,
	todoConversation,
} from "./todos";

const todo = (id: string) => ({ id }) as Todo;

describe("todos CLI helpers", () => {
	test("acts as the agent inside an agent's terminal", () => {
		expect(todoActor({ SUPERSET_AGENT_ID: "claude" })).toBe("agent");
		expect(todoActor({})).toBe("user");
	});

	test("defaults to the terminal it runs in, flags win", () => {
		const env = { SUPERSET_WORKSPACE_ID: "ws", SUPERSET_TERMINAL_ID: "term" };
		expect(todoConversation({}, env)).toEqual({
			workspaceId: "ws",
			terminalId: "term",
		});
		expect(todoConversation({ terminal: "other" }, env).terminalId).toBe(
			"other",
		);
		expect(() => todoConversation({}, {})).toThrow();
	});

	test("resolves an unambiguous short id", () => {
		const todos = [todo("abc123"), todo("abd456")];
		expect(resolveTodoId("abc", todos)).toBe("abc123");
		expect(() => resolveTodoId("ab", todos)).toThrow(/Several/);
		expect(() => resolveTodoId("zz", todos)).toThrow(/not found/);
	});

	test("an empty value clears a field", () => {
		expect(clearable(undefined)).toBeUndefined();
		expect(clearable(" ")).toBeNull();
		expect(clearable(" 2026-10-30 ")).toBe("2026-10-30");
	});
});
