import { describe, expect, test } from "bun:test";
import type { AgentReport } from "renderer/hooks/host-service/useHostAgentReports";
import type { ConversationTodo } from "renderer/hooks/host-service/useHostConversationTodos";
import { buildDeskQueue } from "./buildDeskQueue";

const report = (fields: Partial<AgentReport>) =>
	({
		id: "r",
		workspaceId: "ws",
		terminalId: "term",
		kind: "done",
		status: "open",
		createdAt: 0,
		...fields,
	}) as AgentReport;

const todo = (fields: Partial<ConversationTodo>) =>
	({
		id: "t",
		workspaceId: "ws",
		terminalId: "term",
		author: "agent",
		done: false,
		createdAt: 0,
		...fields,
	}) as ConversationTodo;

const names = new Map([["ws", "Desk"]]);

describe("buildDeskQueue", () => {
	test("groups by kind, decisions first, oldest first", () => {
		const queue = buildDeskQueue(
			[
				{
					hostUrl: "h",
					reports: [
						report({ id: "done-new", kind: "done", createdAt: 3 }),
						report({ id: "decision", kind: "decision", createdAt: 5 }),
						report({ id: "done-old", kind: "done", createdAt: 1 }),
					],
					todos: [todo({ id: "todo", createdAt: 0 })],
				},
			],
			names,
		);
		expect(queue.map((item) => item.key)).toEqual([
			"report:decision",
			"report:done-old",
			"report:done-new",
			"todo:todo",
		]);
		expect(queue[0]?.workspaceName).toBe("Desk");
	});

	test("leaves out progress, closed reports, the user's and checked to-dos, unknown workspaces", () => {
		const queue = buildDeskQueue(
			[
				{
					hostUrl: "h",
					reports: [
						report({ id: "a", kind: "progress" }),
						report({ id: "b", status: "answered" }),
						report({ id: "c", workspaceId: "archived" }),
					],
					todos: [
						todo({ id: "d", author: "user" }),
						todo({ id: "e", done: true }),
					],
				},
				{ hostUrl: "old-host", reports: null, todos: null },
			],
			names,
		);
		expect(queue).toEqual([]);
	});
});
