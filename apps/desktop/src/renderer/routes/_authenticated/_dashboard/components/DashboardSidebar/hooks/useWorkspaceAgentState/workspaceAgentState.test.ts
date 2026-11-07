import { describe, expect, test } from "bun:test";
import { deriveWorkspaceAgentState } from "./workspaceAgentState";

const binding = (
	terminalId: string,
	lastEventType: string,
	lastEventAt = 100,
) => ({
	terminalId,
	lastEventType,
	lastEventAt,
});

describe("deriveWorkspaceAgentState", () => {
	test("idle with no agent", () => {
		expect(
			deriveWorkspaceAgentState({
				status: null,
				sandboxStatus: null,
				bindings: [],
				terminalSeenAt: {},
			}),
		).toEqual({ state: "idle", blockedCount: 0, waitingSince: null });
	});

	test("takes the most urgent conversation and counts those blocked on the user", () => {
		const result = deriveWorkspaceAgentState({
			status: "working",
			sandboxStatus: null,
			bindings: [
				binding("a", "Start", 50),
				binding("b", "PermissionRequest", 80),
				binding("c", "Stop", 60),
				binding("d", "PermissionRequest", 70),
			],
			terminalSeenAt: {},
		});
		expect(result.state).toBe("needsYou");
		expect(result.blockedCount).toBe(2);
		expect(result.waitingSince).toBe(60);
	});

	test("a seen finished turn is idle and does not wait", () => {
		const result = deriveWorkspaceAgentState({
			status: null,
			sandboxStatus: null,
			bindings: [binding("a", "Stop", 100)],
			terminalSeenAt: { a: 200 },
		});
		expect(result).toEqual({
			state: "idle",
			blockedCount: 0,
			waitingSince: null,
		});
	});

	test("a dead sandbox is failed", () => {
		expect(
			deriveWorkspaceAgentState({
				status: "working",
				sandboxStatus: "failed",
				bindings: [],
				terminalSeenAt: {},
			}).state,
		).toBe("failed");
	});
});
