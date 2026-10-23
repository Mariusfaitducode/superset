import { describe, expect, it } from "bun:test";
import type { AgentSessionView } from "../../types";
import { sortAgentSessions } from "./sortAgentSessions";

const view = (
	title: string,
	lastHumanAt: number | null,
	memory: number,
): AgentSessionView => ({
	pid: 1,
	sessionId: title,
	cwd: "/",
	name: null,
	status: "idle",
	waitingFor: null,
	startedAt: 0,
	lastHumanAt,
	cpu: 0,
	memory,
	processCount: 1,
	terminalId: null,
	workspaceId: null,
	title,
	workspaceLabel: "",
});

const sessions = [view("b", 300, 10), view("a", 100, 30), view("c", null, 20)];

describe("sortAgentSessions", () => {
	it("puts the longest-unanswered first, never-answered by start time", () => {
		expect(
			sortAgentSessions(sessions, "last-reply").map((s) => s.title),
		).toEqual(["c", "a", "b"]);
	});

	it("sorts by memory, heaviest first, or by name", () => {
		expect(sortAgentSessions(sessions, "memory").map((s) => s.title)).toEqual([
			"a",
			"c",
			"b",
		]);
		expect(sortAgentSessions(sessions, "name").map((s) => s.title)).toEqual([
			"a",
			"b",
			"c",
		]);
	});
});
