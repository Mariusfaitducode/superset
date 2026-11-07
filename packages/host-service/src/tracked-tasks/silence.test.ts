import { describe, expect, test } from "bun:test";
import { findTaskAgent, IDLE_GRACE_MS, silenceOf } from "./silence";
import type { TrackedTask } from "./store";

const NOW = 10_000_000;

const task = (fields: Partial<TrackedTask> = {}): TrackedTask => ({
	id: "t",
	workspaceId: "ws",
	terminalId: "term-1",
	conversationId: "claude-a",
	title: "x",
	steps: [],
	currentStep: null,
	progress: null,
	status: "running",
	notes: [],
	link: null,
	ci: null,
	silenceAfterMinutes: 15,
	failReason: null,
	createdAt: NOW - 1_000,
	updatedAt: NOW - 1_000,
	endedAt: null,
	archivedAt: null,
	archivedBy: null,
	...fields,
});

const working = { lastEventType: "Start", lastEventAt: NOW - 1_000 };

describe("silenceOf", () => {
	test("a task with fresh news and a working agent is not silent", () => {
		expect(silenceOf(task(), working, NOW)).toBeNull();
	});

	test("no news past the threshold", () => {
		expect(
			silenceOf(task({ updatedAt: NOW - 16 * 60_000 }), working, NOW),
		).toBe("no-news");
	});

	test("the conversation's agent is gone", () => {
		expect(silenceOf(task(), null, NOW)).toBe("agent-gone");
	});

	test("the agent stopped or waits on a permission past the grace", () => {
		const old = NOW - IDLE_GRACE_MS - 1;
		const stale = task({ updatedAt: old });
		expect(
			silenceOf(stale, { lastEventType: "Stop", lastEventAt: old }, NOW),
		).toBe("agent-idle");
		expect(
			silenceOf(
				stale,
				{ lastEventType: "PermissionRequest", lastEventAt: old },
				NOW,
			),
		).toBe("agent-blocked");
		expect(
			silenceOf(task(), { lastEventType: "Stop", lastEventAt: old }, NOW),
		).toBeNull();
	});

	test("a followed CI run needs no agent, unless GitHub stops answering", () => {
		const ci = {
			repo: "o/r",
			runId: 1,
			pullRequest: null,
			workflow: null,
			jobsTotal: 3,
			jobsDone: 1,
			currentJob: "Test",
			runUrl: null,
			checkedAt: NOW,
			error: null,
		};
		const quiet = NOW - 60 * 60_000;
		expect(silenceOf(task({ ci, updatedAt: quiet }), null, NOW)).toBeNull();
		expect(
			silenceOf(
				task({ ci: { ...ci, error: "gh: 502" }, updatedAt: quiet }),
				null,
				NOW,
			),
		).toBe("ci-unreachable");
	});

	test("finished tasks are never silent", () => {
		expect(silenceOf(task({ status: "done" }), null, NOW)).toBeNull();
	});
});

describe("findTaskAgent", () => {
	test("follows the conversation to the terminal it was resumed in", () => {
		const live = [
			{ terminalId: "term-1", agentSessionId: "other" },
			{ terminalId: "term-7", agentSessionId: "claude-a" },
		];
		expect(findTaskAgent(task(), live)?.terminalId).toBe("term-7");
		expect(
			findTaskAgent(task({ conversationId: null }), live)?.terminalId,
		).toBe("term-1");
		expect(findTaskAgent(task(), [])).toBeNull();
	});
});
