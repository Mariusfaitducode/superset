import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type AgentBindingRow,
	followConversations,
	planConversationMoves,
} from "./follow-conversations";
import { ConversationTodoStore } from "./store";

let dir: string;
let store: ConversationTodoStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "todos-follow-"));
	store = new ConversationTodoStore(join(dir, "todos.json"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

const binding = (
	terminalId: string,
	agentSessionId: string | null,
	startedAt: number,
): AgentBindingRow => ({
	terminalId,
	workspaceId: "ws-1",
	agentSessionId,
	startedAt,
});

describe("planConversationMoves", () => {
	test("targets the terminal each agent session started in last", () => {
		expect(
			planConversationMoves([
				binding("term-new", "claude-a", 300),
				binding("term-old", "claude-a", 100),
				binding("term-older", "claude-a", 50),
				binding("term-b", "claude-b", 200),
				binding("shell", null, 400),
			]),
		).toEqual([
			{
				conversationId: "claude-a",
				terminalId: "term-new",
				workspaceId: "ws-1",
				formerTerminalIds: ["term-older", "term-old"],
			},
			{
				conversationId: "claude-b",
				terminalId: "term-b",
				workspaceId: "ws-1",
				formerTerminalIds: [],
			},
		]);
	});
});

describe("followConversations", () => {
	test("brings to-dos left on the terminal an agent was resumed from", () => {
		const left = store.add({
			workspaceId: "ws-1",
			terminalId: "term-old",
			actor: "user",
			text: "Review the PR",
		});

		const moved = followConversations(store, [
			binding("term-old", "claude-a", 100),
			binding("term-new", "claude-a", 300),
		]);

		expect(moved).toBe(1);
		expect(store.list({ terminalId: "term-new" })).toMatchObject([
			{ id: left.id, conversationId: "claude-a", text: "Review the PR" },
		]);
		expect(store.list({ terminalId: "term-old" })).toEqual([]);
	});

	test("follows a conversation it has seen even once its old terminal is forgotten", () => {
		store.add({
			workspaceId: "ws-1",
			terminalId: "term-1",
			conversationId: "claude-a",
			actor: "agent",
			text: "Ping the reviewer",
		});

		followConversations(store, [binding("term-2", "claude-a", 500)]);

		expect(store.list({ terminalId: "term-2" })).toHaveLength(1);
	});

	test("leaves other conversations and plain shells alone", () => {
		store.add({
			workspaceId: "ws-1",
			terminalId: "term-b",
			actor: "user",
			text: "Other conversation",
		});
		store.add({
			workspaceId: "ws-1",
			terminalId: "shell",
			actor: "user",
			text: "In a shell",
		});

		followConversations(store, [
			binding("term-old", "claude-a", 100),
			binding("term-new", "claude-a", 300),
			binding("term-b", "claude-b", 200),
		]);

		expect(store.list({ terminalId: "term-b" })).toMatchObject([
			{ conversationId: "claude-b" },
		]);
		expect(store.list({ terminalId: "shell" })).toMatchObject([
			{ conversationId: null },
		]);
	});

	test("does not rewrite the file when nothing moves", () => {
		store.add({
			workspaceId: "ws-1",
			terminalId: "term-1",
			conversationId: "claude-a",
			actor: "user",
			text: "Stay",
		});
		const [before] = store.list();

		expect(followConversations(store, [binding("term-1", "claude-a", 1)])).toBe(
			0,
		);
		expect(store.list()[0]).toEqual(before);
	});
});
