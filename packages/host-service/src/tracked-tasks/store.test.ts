import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type TrackedTaskCaller,
	TrackedTaskPermissionError,
	TrackedTaskStore,
} from "./store";

let dir: string;
let filePath: string;
let clock: number;
let store: TrackedTaskStore;

const agent: TrackedTaskCaller = {
	actor: "agent",
	terminalId: "term-1",
	conversationId: "claude-a",
};
const user: TrackedTaskCaller = { actor: "user" };

const start = (title = "Disk cleanup SN004", steps?: string[]) =>
	store.start({
		workspaceId: "ws-1",
		terminalId: "term-1",
		conversationId: "claude-a",
		title,
		steps,
	});

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "tracked-tasks-"));
	filePath = join(dir, "state", "tracked-tasks.json");
	clock = 1_000;
	store = new TrackedTaskStore(filePath, () => clock++);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("TrackedTaskStore", () => {
	test("starts a running task on its first step and keeps it on disk", () => {
		const task = start("Cleanup", ["Snapshot", " Purge logs ", "Check"]);
		expect(task).toMatchObject({
			status: "running",
			steps: ["Snapshot", "Purge logs", "Check"],
			currentStep: 0,
			progress: null,
			archivedAt: null,
		});
		expect(new TrackedTaskStore(filePath).list()).toHaveLength(1);
	});

	test("moves through steps by index or name, with notes", () => {
		const task = start("Cleanup", ["Snapshot", "Purge logs", "Check"]);
		expect(
			store.step(agent, task.id, "purge LOGS", "12 GB freed"),
		).toMatchObject({ currentStep: 1, notes: [{ text: "12 GB freed" }] });
		expect(store.step(agent, task.id, 2).currentStep).toBe(2);
		expect(() => store.step(agent, task.id, "Nope")).toThrow(/No such step/);
	});

	test("clamps progress and records news time", () => {
		const task = start();
		const updated = store.progress(agent, task.id, 140);
		expect(updated.progress).toBe(100);
		expect(updated.updatedAt).toBeGreaterThan(task.updatedAt);
	});

	test("ends done or failed, and refuses updates after", () => {
		const done = store.finish(agent, start("A", ["x", "y"]).id, {
			status: "done",
		});
		expect(done).toMatchObject({ status: "done", currentStep: 2 });
		expect(done.endedAt).not.toBeNull();
		expect(() => store.note(agent, done.id, "late")).toThrow(/already done/);

		const failed = store.finish(agent, start("B").id, {
			status: "failed",
			reason: "Disk full",
		});
		expect(failed).toMatchObject({
			status: "failed",
			failReason: "Disk full",
			notes: [{ text: "Disk full" }],
		});
	});

	test("lets only the conversation that started a task update it", () => {
		const task = start();
		const other: TrackedTaskCaller = {
			actor: "agent",
			terminalId: "term-2",
			conversationId: "claude-b",
		};
		expect(() => store.note(other, task.id, "hi")).toThrow(
			TrackedTaskPermissionError,
		);
		expect(() => store.note(user, task.id, "hi")).toThrow(
			TrackedTaskPermissionError,
		);
		const resumed: TrackedTaskCaller = {
			actor: "agent",
			terminalId: "term-9",
			conversationId: "claude-a",
		};
		expect(store.note(resumed, task.id, "after resume").notes).toHaveLength(1);
	});

	test("finds the conversation's latest running task", () => {
		start("first");
		const second = start("second");
		expect(store.latestRunning(agent).id).toBe(second.id);
		store.finish(agent, second.id, { status: "done" });
		expect(store.latestRunning(agent).title).toBe("first");
	});

	test("only the user archives and restores", () => {
		const task = start();
		expect(() => store.archive(agent, task.id)).toThrow(
			TrackedTaskPermissionError,
		);
		expect(store.archive(user, task.id)).toMatchObject({ archivedBy: "user" });
		expect(store.list()).toEqual([]);
		expect(store.list({ archived: true })).toHaveLength(1);
		store.restore(user, task.id);
		expect(store.list()).toHaveLength(1);
	});

	test("CI reads end the task and count as news only when jobs move", () => {
		const task = store.start({
			workspaceId: "ws-1",
			terminalId: "term-1",
			conversationId: null,
			title: "CI",
			link: "https://github.com/o/r/pull/1",
			ci: {
				repo: "o/r",
				runId: null,
				pullRequest: 1,
				workflow: null,
				jobsTotal: 0,
				jobsDone: 0,
				currentJob: null,
				runUrl: null,
				checkedAt: null,
				error: null,
			},
		});
		const ci = { ...(task.ci as NonNullable<typeof task.ci>), jobsTotal: 3 };
		const moved = store.recordCi(task.id, ci);
		expect(moved.updatedAt).toBeGreaterThan(task.updatedAt);
		const same = store.recordCi(task.id, { ...ci, checkedAt: 5 });
		expect(same.updatedAt).toBe(moved.updatedAt);
		expect(
			store.recordCi(task.id, { ...ci, jobsDone: 3 }, { status: "done" })
				.status,
		).toBe("done");
	});

	test("starts empty on a missing or broken file", () => {
		expect(new TrackedTaskStore(join(dir, "none.json")).list()).toEqual([]);
	});
});
