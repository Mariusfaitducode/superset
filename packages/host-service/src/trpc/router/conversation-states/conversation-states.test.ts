import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostServiceContext } from "../../../types";

const home = mkdtempSync(join(tmpdir(), "states-router-"));
process.env.SUPERSET_HOME_DIR = home;
const { conversationStatesRouter } = await import("./conversation-states");

afterAll(() => {
	rmSync(home, { recursive: true, force: true });
});

const changed: string[] = [];
const caller = conversationStatesRouter.createCaller({
	isAuthenticated: true,
	eventBus: {
		broadcastHostStoreChanged: (store: string) => changed.push(store),
	},
	terminalAgentStore: {
		get: () => ({ agentSessionId: "session-1" }),
	},
} as unknown as HostServiceContext);

describe("conversationStatesRouter", () => {
	test("pins a state as the user, ties it to the agent session and tells clients", async () => {
		const mark = await caller.set({
			workspaceId: "ws",
			terminalId: "term",
			state: "resume",
		});
		expect(mark).toMatchObject({
			setBy: "user",
			state: "resume",
			conversationId: "session-1",
		});
		expect(await caller.list({ workspaceId: "ws" })).toHaveLength(1);
		expect(changed).toEqual(["conversation-states"]);
	});

	test("refuses working, which only the live agent can say", async () => {
		await expect(
			caller.set({
				workspaceId: "ws",
				terminalId: "term",
				state: "working" as never,
			}),
		).rejects.toThrow();
	});

	test("clears back to the inferred state", async () => {
		expect(await caller.clear({ terminalId: "term" })).toBe(true);
		expect(await caller.clear({ terminalId: "term" })).toBe(false);
		expect(await caller.list({})).toEqual([]);
	});
});
