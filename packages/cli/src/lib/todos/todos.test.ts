import { describe, expect, test } from "bun:test";
import {
	clearable,
	draftText,
	resolveTodoId,
	richFields,
	type Todo,
	todoActor,
	todoConversation,
	todoReport,
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

	test("sets only the rich fields passed, an empty one clears", () => {
		expect(richFields({})).toEqual({});
		expect(
			richFields({
				step: [" Check the address ", "Send it"],
				recipient: "",
				channel: " email ",
			}),
		).toEqual({
			steps: ["Check the address", "Send it"],
			recipient: null,
			channel: "email",
		});
		expect(richFields({ step: [""] })).toEqual({ steps: [] });
	});

	test("turns a literal \\n in a draft into a line break", () => {
		expect(draftText("Hi Paul,\\n\\nThanks")).toBe("Hi Paul,\n\nThanks");
		expect(draftText("a\nb \\n c")).toBe("a\nb \\n c");
		expect(draftText("  ")).toBeNull();
	});

	test("reports the open to-dos by workspace and conversation", () => {
		const base: Omit<Todo, "id" | "text"> = {
			workspaceId: "ws-1",
			terminalId: "term-1",
			conversationId: "conv-1234567890",
			done: false,
			author: "agent",
			doneBy: null,
			priority: "normal",
			kind: "other",
			dueOn: null,
			link: null,
			steps: [],
			draft: null,
			recipient: null,
			channel: null,
			createdAt: 1,
			updatedAt: 1,
		};
		const report = todoReport(
			[
				{ ...base, id: "a", text: "Later" },
				{
					...base,
					id: "b",
					text: "Mail Paul",
					kind: "mail",
					dueOn: "2026-10-20",
					steps: ["Check the address", "Send it"],
					draft: "Hi Paul,\n\nThanks",
					recipient: "paul@example.com",
					channel: "email",
				},
				{ ...base, id: "c", text: "Done already", done: true },
			],
			new Map([["ws-1", "Launch"]]),
			"2026-10-25",
		);
		expect(report).toContain("2 open to-dos.");
		expect(report).toContain("## Launch");
		expect(report).toContain("### Conversation conv-123");
		expect(report).not.toContain("Done already");
		expect(report.indexOf("Mail Paul")).toBeLessThan(report.indexOf("Later"));
		expect(report).toContain("(mail, overdue, due 2026-10-20, from the agent)");
		expect(report).toContain("To: paul@example.com · Via: email");
		expect(report).toContain("    2. Send it");
		expect(report).toContain("    Hi Paul,\n\n    Thanks");
		expect(todoReport([], new Map(), "2026-10-25")).toContain("Nothing open");
	});
});
