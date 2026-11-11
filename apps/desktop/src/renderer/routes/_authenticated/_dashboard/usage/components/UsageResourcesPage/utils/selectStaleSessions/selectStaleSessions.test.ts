import { describe, expect, it } from "bun:test";
import type { AgentSessionRow } from "../../types";
import { selectStaleSessions } from "./selectStaleSessions";

const HOUR = 60 * 60 * 1000;
const NOW = 1_000 * HOUR;

function session(
	sessionId: string,
	overrides: Partial<AgentSessionRow>,
): AgentSessionRow {
	return {
		pid: 1,
		sessionId,
		cwd: "/",
		name: null,
		status: "idle",
		waitingFor: null,
		startedAt: NOW - 100 * HOUR,
		lastHumanAt: null,
		cpu: 0,
		memory: 0,
		processCount: 1,
		terminalId: null,
		workspaceId: null,
		...overrides,
	};
}

describe("selectStaleSessions", () => {
	it("keeps idle sessions unanswered past the threshold, oldest first", () => {
		const sessions = [
			session("recent", { lastHumanAt: NOW - 2 * HOUR }),
			session("old", { lastHumanAt: NOW - 30 * HOUR }),
			session("older", { lastHumanAt: NOW - 72 * HOUR }),
		];
		expect(
			selectStaleSessions(sessions, 24, NOW).map((s) => s.sessionId),
		).toEqual(["older", "old"]);
	});

	it("never selects a session that is busy, in a shell or waiting", () => {
		const sessions = (["busy", "shell", "waiting", "unknown"] as const).map(
			(status) => session(status, { status, lastHumanAt: NOW - 72 * HOUR }),
		);
		expect(selectStaleSessions(sessions, 24, NOW)).toEqual([]);
	});

	it("counts a session never written to from its start", () => {
		expect(
			selectStaleSessions(
				[
					session("never-answered", { startedAt: NOW - 30 * HOUR }),
					session("just-started", { startedAt: NOW - HOUR }),
				],
				24,
				NOW,
			).map((s) => s.sessionId),
		).toEqual(["never-answered"]);
	});
});
