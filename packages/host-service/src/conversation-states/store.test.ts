import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConversationMarkStore } from "./store";
import { applyBindings, isNewTurn } from "./watch-conversation-turns";

const dir = mkdtempSync(join(tmpdir(), "conversation-states-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let clock = 1_000;
const tick = () => clock;
let n = 0;
const newStore = () =>
	new ConversationMarkStore(join(dir, `marks-${n++}.json`), tick);

const where = { workspaceId: "ws", terminalId: "t1", conversationId: "s1" };

describe("ConversationMarkStore", () => {
	test("keeps one mark per conversation and survives a reload", () => {
		const path = join(dir, "reload.json");
		const store = new ConversationMarkStore(path, tick);
		store.set({ ...where, state: "resume", actor: "user" });
		store.set({ ...where, state: "done", actor: "user" });
		const reloaded = new ConversationMarkStore(path, tick);
		expect(reloaded.list()).toEqual([
			{ ...where, state: "done", setBy: "user", setAt: clock },
		]);
	});

	test("clears only a mark older than the new turn", () => {
		const store = newStore();
		clock = 2_000;
		store.set({ ...where, state: "resume", actor: "agent" });
		expect(store.clearIfOlder("t1", 1_500)).toBe(false);
		expect(store.clearIfOlder("t1", 2_500)).toBe(true);
		expect(store.list()).toEqual([]);
	});

	test("follows a resumed conversation to its new terminal", () => {
		const store = newStore();
		store.set({ ...where, state: "todos", actor: "user" });
		expect(
			store.followConversation({
				conversationId: "s1",
				terminalId: "t2",
				workspaceId: "ws",
			}),
		).toBe(true);
		expect(store.list().map((mark) => mark.terminalId)).toEqual(["t2"]);
	});
});

describe("turn watcher", () => {
	test("only a start after a finished turn is a new turn", () => {
		expect(isNewTurn("Stop", "Start")).toBe(true);
		expect(isNewTurn("Failed", "Start")).toBe(true);
		expect(isNewTurn("Start", "Start")).toBe(false);
		expect(isNewTurn("PermissionRequest", "Start")).toBe(false);
		expect(isNewTurn(undefined, "Start")).toBe(false);
		expect(isNewTurn("Start", "Stop")).toBe(false);
	});

	test("a new prompt clears the mark, tool calls of the same turn do not", () => {
		const store = newStore();
		const types = new Map<string, string>();
		const binding = {
			terminalId: "t1",
			workspaceId: "ws",
			agentSessionId: "s1",
			lastEventType: "Start",
			lastEventAt: 100,
		};
		applyBindings(store, types, [binding]);
		clock = 200;
		// The agent pins itself mid-turn, then keeps working and stops.
		store.set({ ...where, state: "done", actor: "agent" });
		applyBindings(store, types, [{ ...binding, lastEventAt: 250 }]);
		applyBindings(store, types, [
			{ ...binding, lastEventType: "Stop", lastEventAt: 300 },
		]);
		expect(store.list()).toHaveLength(1);
		expect(
			applyBindings(store, types, [{ ...binding, lastEventAt: 400 }]),
		).toBe(true);
		expect(store.list()).toEqual([]);
	});
});
