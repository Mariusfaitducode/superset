import { describe, expect, test } from "bun:test";
import { nextNeedsYouTarget, summarizeNeedsYou } from "./needsYou";

const binding = (
	terminalId: string,
	lastEventType: string,
	lastEventAt: number,
) => ({
	terminalId,
	lastEventType,
	lastEventAt,
});

describe("summarizeNeedsYou", () => {
	const workspaces = [
		{
			id: "w1",
			bindings: [
				binding("a", "PermissionRequest", 30),
				binding("b", "Start", 10),
			],
		},
		{
			id: "w2",
			bindings: [binding("c", "Failed", 20), binding("d", "Stop", 5)],
		},
	];

	test("counts the agents blocked on the user and the urgent to-dos", () => {
		const summary = summarizeNeedsYou({
			workspaces,
			terminalSeenAt: {},
			todos: [
				{ workspaceId: "w1", terminalId: "b", done: false, priority: "high" },
				{ workspaceId: "w1", terminalId: "b", done: true, priority: "high" },
				{ workspaceId: "w1", terminalId: "a", done: false, priority: "low" },
				// A conversation that is gone.
				{ workspaceId: "w1", terminalId: "z", done: false, priority: "high" },
			],
		});
		expect(summary.agents).toBe(2);
		expect(summary.todos).toBe(1);
		expect(summary.targets.map((target) => target.terminalId)).toEqual([
			"b",
			"c",
			"a",
		]);
	});

	test("a finished turn does not need the user", () => {
		const summary = summarizeNeedsYou({
			workspaces: [{ id: "w", bindings: [binding("d", "Stop", 5)] }],
			terminalSeenAt: {},
			todos: [],
		});
		expect(summary).toEqual({ agents: 0, todos: 0, targets: [] });
	});
});

describe("nextNeedsYouTarget", () => {
	const targets = ["a", "b", "c"].map((terminalId, since) => ({
		workspaceId: "w",
		terminalId,
		since,
	}));

	test("starts with the longest waiting, then cycles", () => {
		expect(nextNeedsYouTarget(targets, null)?.terminalId).toBe("a");
		expect(nextNeedsYouTarget(targets, "a")?.terminalId).toBe("b");
		expect(nextNeedsYouTarget(targets, "c")?.terminalId).toBe("a");
		expect(nextNeedsYouTarget(targets, "gone")?.terminalId).toBe("a");
		expect(nextNeedsYouTarget([], "a")).toBeNull();
	});
});
