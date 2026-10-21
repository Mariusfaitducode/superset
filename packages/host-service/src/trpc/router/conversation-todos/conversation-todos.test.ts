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

const caller = conversationTodosRouter.createCaller({
	isAuthenticated: true,
} as unknown as HostServiceContext);

describe("conversationTodosRouter", () => {
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
