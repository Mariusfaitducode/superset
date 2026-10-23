import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostServiceContext } from "../../../types";
import { conversationTodosRouter } from "./conversation-todos";

const home = mkdtempSync(join(tmpdir(), "todos-router-"));
process.env.SUPERSET_HOME_DIR = home;

afterAll(() => {
	rmSync(home, { recursive: true, force: true });
});

const changed: string[] = [];
const agentSessions = new Map([["claude-term", "claude-session-1"]]);

const caller = conversationTodosRouter.createCaller({
	isAuthenticated: true,
	eventBus: {
		broadcastHostStoreChanged: (store: string) => changed.push(store),
	},
	terminalAgentStore: {
		get: (terminalId: string) => {
			const agentSessionId = agentSessions.get(terminalId);
			return agentSessionId ? { agentSessionId } : undefined;
		},
	},
} as unknown as HostServiceContext);

describe("conversationTodosRouter", () => {
	test("ties a to-do to the agent conversation of its terminal", async () => {
		const todo = await caller.add({
			workspaceId: "ws-agent",
			terminalId: "claude-term",
			text: "Follow me",
		});
		expect(todo.conversationId).toBe("claude-session-1");
	});

	test("adds as the user by default and lists by workspace", async () => {
		const todo = await caller.add({
			workspaceId: "ws",
			terminalId: "term",
			text: "Answer Paul",
			kind: "message",
		});
		expect(todo.author).toBe("user");
		expect(await caller.list({ workspaceId: "ws" })).toHaveLength(1);
	});

	test("answers FORBIDDEN when an agent edits the user's to-do", async () => {
		const todo = await caller.add({
			workspaceId: "ws",
			terminalId: "term",
			text: "Mine",
		});
		await expect(
			caller.update({ actor: "agent", id: todo.id, text: "x" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(
			(await caller.setDone({ actor: "agent", id: todo.id, done: true }))
				.doneBy,
		).toBe("agent");
	});

	test("tells clients when to-dos change, not on a read or a refusal", async () => {
		changed.length = 0;
		const todo = await caller.add({
			workspaceId: "ws",
			terminalId: "term",
			text: "Ping",
		});
		await caller.list({});
		await expect(
			caller.remove({ actor: "agent", id: todo.id }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await caller.remove({ id: todo.id });
		expect(changed).toEqual(["conversation-todos", "conversation-todos"]);
	});

	test("archives instead of deleting, and restores", async () => {
		const todo = await caller.add({
			workspaceId: "ws-archive",
			terminalId: "term",
			text: "Keep a trace",
		});
		await caller.archive({ id: todo.id });
		expect(await caller.list({ workspaceId: "ws-archive" })).toEqual([]);
		expect(
			await caller.list({ workspaceId: "ws-archive", archived: true }),
		).toMatchObject([{ id: todo.id, archivedBy: "user" }]);
		await caller.restore({ id: todo.id });
		expect(await caller.list({ workspaceId: "ws-archive" })).toMatchObject([
			{ id: todo.id, archivedAt: null },
		]);
	});

	test("answers NOT_FOUND for an unknown id", async () => {
		await expect(
			caller.setDone({ id: "missing", done: true }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	test("accepts only http and https links", async () => {
		await expect(
			caller.add({
				workspaceId: "ws",
				terminalId: "term",
				text: "x",
				link: "javascript:alert(1)",
			}),
		).rejects.toThrow();
		const todo = await caller.add({
			workspaceId: "ws",
			terminalId: "term",
			text: "x",
			link: "https://github.com/a/b/pull/1",
		});
		expect(todo.link).toBe("https://github.com/a/b/pull/1");
	});

	test("rejects a malformed due date", async () => {
		await expect(
			caller.add({
				workspaceId: "ws",
				terminalId: "term",
				text: "x",
				dueOn: "next week",
			}),
		).rejects.toThrow();
	});
});
