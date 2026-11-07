import { describe, expect, test } from "bun:test";
import {
	endedSince,
	formatElapsed,
	sortTasks,
	summarizeTasks,
	taskProgress,
} from "./task-monitor";

const base = {
	steps: [] as string[],
	currentStep: null as number | null,
	progress: null as number | null,
	ci: null as { jobsDone: number; jobsTotal: number } | null,
};
type Fields = Partial<typeof base> & {
	status?: "running" | "done" | "failed";
};
const t = (fields: Fields = {}) =>
	({ status: "running", ...base, ...fields }) as Parameters<
		typeof taskProgress
	>[0];

describe("sortTasks", () => {
	test("running, then failed, then done, newest first", () => {
		const sorted = sortTasks([
			{ id: "d", status: "done" as const, createdAt: 1, endedAt: 9 },
			{ id: "r1", status: "running" as const, createdAt: 1, endedAt: null },
			{ id: "f", status: "failed" as const, createdAt: 2, endedAt: 5 },
			{ id: "r2", status: "running" as const, createdAt: 3, endedAt: null },
		]);
		expect(sorted.map((task) => task.id)).toEqual(["r2", "r1", "f", "d"]);
	});
});

describe("taskProgress", () => {
	test("by steps, then CI jobs, then percent, else indeterminate", () => {
		expect(taskProgress(t({ steps: ["a", "b", "c"], currentStep: 1 }))).toEqual(
			{
				kind: "steps",
				done: 1,
				total: 3,
			},
		);
		expect(
			taskProgress(t({ status: "done", steps: ["a", "b"], currentStep: 0 })),
		).toMatchObject({ done: 2 });
		expect(taskProgress(t({ ci: { jobsDone: 2, jobsTotal: 3 } }))).toEqual({
			kind: "jobs",
			done: 2,
			total: 3,
		});
		expect(taskProgress(t({ progress: 40 }))).toEqual({
			kind: "percent",
			value: 40,
		});
		expect(taskProgress(t())).toEqual({ kind: "indeterminate" });
		expect(taskProgress(t({ status: "done" }))).toEqual({
			kind: "percent",
			value: 100,
		});
	});
});

describe("summarizeTasks", () => {
	test("counts running and failed, averages measurable progress", () => {
		expect(
			summarizeTasks([
				t({ progress: 50 }),
				t({ steps: ["a", "b"], currentStep: 2 }),
				t(),
				t({ status: "failed" }),
				t({ status: "done" }),
			]),
		).toEqual({ running: 3, failed: 1, progress: 0.75 });
		expect(summarizeTasks([t()]).progress).toBeNull();
	});
});

describe("formatElapsed", () => {
	test("minutes, hours, days", () => {
		expect(formatElapsed(20_000)).toBe("<1 min");
		expect(formatElapsed(4 * 60_000)).toBe("4 min");
		expect(formatElapsed(72 * 60_000)).toBe("1 h 12");
		expect(formatElapsed(120 * 60_000)).toBe("2 h");
		expect(formatElapsed(50 * 3_600_000)).toBe("2 d");
	});
});

describe("endedSince", () => {
	test("reports only tasks that ended since the last look", () => {
		const before = new Map([
			["a", "running" as const],
			["b", "running" as const],
			["c", "failed" as const],
		]);
		expect(
			endedSince(before, [
				{ id: "a", status: "failed" },
				{ id: "b", status: "done" },
				{ id: "c", status: "failed" },
				{ id: "new-ended", status: "done" },
				{ id: "new-running", status: "running" },
			]),
		).toEqual({ failed: ["a"], done: ["b", "new-ended"] });
	});

	test("the first look only remembers", () => {
		expect(endedSince(null, [{ id: "a", status: "failed" }])).toEqual({
			failed: [],
			done: [],
		});
	});
});
