import { describe, expect, test } from "bun:test";
import {
	deriveWorkState,
	REPORT_TURN_WINDOW_MS,
	SILENT_TURN_MS,
	type WorkStateInput,
	workStateColorVar,
} from "./work-state";

const since = 10_000_000;
const base: WorkStateInput = {
	conversation: "seen",
	since,
	openTodos: 0,
	reports: [],
	mark: null,
	hasChildren: false,
	now: since + 60_000,
};

const state = (input: Partial<WorkStateInput>) => {
	const info = deriveWorkState({ ...base, ...input });
	return `${info.state}/${info.cause}`;
};

// Filed as the last turn ended.
const fresh = since - 30_000;
// Filed during an earlier turn the agent has moved past.
const stale = since - REPORT_TURN_WINDOW_MS - 1;

describe("deriveWorkState", () => {
	test("a running agent is working, whatever else it has", () => {
		expect(
			state({
				conversation: "working",
				openTodos: 3,
				mark: { state: "done", setBy: "user", setAt: 1 },
			}),
		).toBe("working/running");
	});

	test("a turn silent for over an hour is to check, not working", () => {
		const silent = {
			conversation: "working" as const,
			now: since + SILENT_TURN_MS + 1,
		};
		expect(state(silent)).toBe("check/silent");
		// Its subagents speak for it while the parent itself is quiet.
		expect(state({ ...silent, hasChildren: true })).toBe("working/running");
		// A pin cannot hide a turn that may have lost its process.
		expect(
			state({ ...silent, mark: { state: "resume", setBy: "user", setAt: 1 } }),
		).toBe("check/silent");
	});

	test("questions, permissions and errors wait on the user", () => {
		expect(state({ conversation: "request" })).toBe("waiting/permission");
		expect(state({ conversation: "failed" })).toBe("waiting/error");
		expect(
			state({
				reports: [{ kind: "decision", status: "open", createdAt: fresh }],
				openTodos: 2,
			}),
		).toBe("waiting/decision");
		expect(
			state({ reports: [{ kind: "draft", status: "open", createdAt: fresh }] }),
		).toBe("waiting/draft");
		expect(state({ conversation: "unseen" })).toBe("waiting/unread");
	});

	test("a report older than the latest turn does not decide", () => {
		expect(
			state({
				reports: [{ kind: "decision", status: "open", createdAt: stale }],
			}),
		).toBe("resume/read");
		expect(
			state({ reports: [{ kind: "done", status: "open", createdAt: stale }] }),
		).toBe("resume/read");
	});

	test("an answered question no longer waits", () => {
		expect(
			state({
				reports: [{ kind: "blocked", status: "answered", createdAt: fresh }],
			}),
		).toBe("resume/read");
	});

	test("open to-dos beat a done report", () => {
		expect(
			state({
				openTodos: 1,
				reports: [{ kind: "done", status: "open", createdAt: fresh }],
			}),
		).toBe("todos/todos");
	});

	test("a done report of the last turn is done, acknowledged or not", () => {
		expect(
			state({ reports: [{ kind: "done", status: "open", createdAt: fresh }] }),
		).toBe("done/reportedDone");
		expect(
			state({
				reports: [{ kind: "done", status: "dismissed", createdAt: fresh }],
			}),
		).toBe("done/reportedDone");
	});

	test("a read reply with nothing asked is parked; a fresh agent too", () => {
		expect(state({})).toBe("resume/read");
		expect(state({ conversation: "idle" })).toBe("resume/notStarted");
	});

	test("a pin overrides the inferred state and keeps it for display", () => {
		const info = deriveWorkState({
			...base,
			conversation: "unseen",
			mark: { state: "resume", setBy: "user", setAt: 5 },
		});
		expect(info.state).toBe("resume");
		expect(info.cause).toBe("pinned");
		expect(info.inferred).toEqual({ state: "waiting", cause: "unread" });
	});

	test("errors keep the failed color", () => {
		expect(workStateColorVar({ state: "waiting", cause: "error" })).toBe(
			"var(--sb-state-failed)",
		);
		expect(workStateColorVar({ state: "todos", cause: "todos" })).toBe(
			"var(--sb-state-todos)",
		);
	});
});
