import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TrackedTaskCiWatcher } from "./ci-watcher";
import type { GithubCiRead } from "./github-ci";
import { TrackedTaskStore } from "./store";

let dir: string;
let store: TrackedTaskStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "tracked-ci-"));
	store = new TrackedTaskStore(join(dir, "tasks.json"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

const startCi = () =>
	store.start({
		workspaceId: "ws",
		terminalId: "term",
		conversationId: null,
		title: "Fork CI",
		link: "https://github.com/o/r/actions/runs/1",
		ci: {
			repo: "o/r",
			runId: 1,
			pullRequest: null,
			workflow: null,
			jobsTotal: 0,
			jobsDone: 0,
			currentJob: null,
			runUrl: null,
			checkedAt: null,
			error: null,
		},
	});

describe("TrackedTaskCiWatcher", () => {
	test("moves the task with the run and ends it, telling clients each time", async () => {
		const task = startCi();
		store.start({
			workspaceId: "ws",
			terminalId: "term",
			conversationId: null,
			title: "No CI",
		});
		const reads: GithubCiRead[] = [
			{
				jobsTotal: 3,
				jobsDone: 1,
				currentJob: "Test",
				runUrl: null,
				outcome: null,
			},
			{
				jobsTotal: 3,
				jobsDone: 1,
				currentJob: "Test",
				runUrl: null,
				outcome: null,
			},
			{
				jobsTotal: 3,
				jobsDone: 3,
				currentJob: null,
				runUrl: null,
				outcome: { status: "failed", reason: "Failed: Fork CI: Test" },
			},
		];
		let calls = 0;
		let changes = 0;
		const watcher = new TrackedTaskCiWatcher({
			store,
			readCi: async () => {
				const read = reads[calls++];
				if (!read) throw new Error("no more reads");
				return read;
			},
			onChange: () => changes++,
		});
		await watcher.tick();
		expect(store.get(task.id).ci).toMatchObject({
			jobsDone: 1,
			currentJob: "Test",
		});
		await watcher.tick();
		expect(changes).toBe(1);
		await watcher.tick();
		expect(store.get(task.id)).toMatchObject({
			status: "failed",
			failReason: "Failed: Fork CI: Test",
		});
		expect(changes).toBe(2);
		await watcher.tick();
		expect(calls).toBe(3);
	});

	test("keeps the error of a failed read on the task", async () => {
		const task = startCi();
		const watcher = new TrackedTaskCiWatcher({
			store,
			readCi: async () => {
				throw new Error("gh: not logged in");
			},
			onChange: () => {},
		});
		await watcher.tick();
		expect(store.get(task.id)).toMatchObject({
			status: "running",
			ci: { error: "gh: not logged in" },
		});
	});
});
