import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostServiceContext } from "../../../types";
import { trackedTasksRouter } from "./tracked-tasks";

const home = mkdtempSync(join(tmpdir(), "tracked-router-"));
process.env.SUPERSET_HOME_DIR = home;

afterAll(() => {
	rmSync(home, { recursive: true, force: true });
});

const changed: string[] = [];
const live = [
	{
		terminalId: "claude-term",
		agentSessionId: "claude-session-1",
		lastEventType: "Start",
		lastEventAt: Date.now(),
	},
];

const caller = trackedTasksRouter.createCaller({
	isAuthenticated: true,
	eventBus: {
		broadcastHostStoreChanged: (store: string) => changed.push(store),
	},
	terminalAgentStore: {
		get: (terminalId: string) =>
			live.find((binding) => binding.terminalId === terminalId),
		list: () => live,
	},
} as unknown as HostServiceContext);

const where = { workspaceId: "ws", terminalId: "claude-term" };

describe("trackedTasksRouter", () => {
	test("starts a task tied to the agent's conversation and tells clients", async () => {
		changed.length = 0;
		const task = await caller.start({
			...where,
			title: "Disk cleanup",
			steps: ["Snapshot", "Purge"],
		});
		expect(task.conversationId).toBe("claude-session-1");
		expect(changed).toEqual(["tracked-tasks"]);
	});

	test("updates the caller's latest running task when no id is given", async () => {
		const task = await caller.start({ ...where, title: "Latest" });
		const noted = await caller.note({
			terminalId: "claude-term",
			text: "halfway",
		});
		expect(noted.id).toBe(task.id);
		await caller.progress({ terminalId: "claude-term", percent: 50 });
		const done = await caller.done({ terminalId: "claude-term", note: "ok" });
		expect(done).toMatchObject({ id: task.id, status: "done" });
	});

	test("lists running tasks with their silence", async () => {
		const tasks = await caller.list({ workspaceId: "ws" });
		expect(tasks.find((task) => task.title === "Disk cleanup")?.silence).toBe(
			null,
		);
	});

	test("refuses another conversation's task and an agent's archive", async () => {
		const task = await caller.start({ ...where, title: "Mine" });
		await expect(
			caller.note({ terminalId: "other-term", id: task.id, text: "x" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			caller.archive({ actor: "agent", id: task.id }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await caller.archive({ id: task.id });
		expect(
			(await caller.list({ archived: true })).map((item) => item.id),
		).toContain(task.id);
	});

	test("follows a GitHub link's CI and leaves other links alone", async () => {
		const pr = await caller.start({
			...where,
			title: "CI",
			link: "https://github.com/o/r/pull/25",
			workflow: "Fork CI",
		});
		expect(pr.ci).toMatchObject({
			repo: "o/r",
			pullRequest: 25,
			workflow: "Fork CI",
		});
		const other = await caller.start({
			...where,
			title: "Grafana",
			link: "https://grafana.example.com/d/1",
		});
		expect(other.ci).toBeNull();
	});

	test("answers NOT_FOUND without a running task", async () => {
		await expect(
			caller.note({ terminalId: "nobody", text: "x" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
