import type { HostServiceClient } from "renderer/lib/host-service-client";

export type TrackedTask = Awaited<
	ReturnType<HostServiceClient["trackedTasks"]["list"]["query"]>
>[number];

/** A task with the host it lives on, which the app needs to act on it. */
export interface MonitoredTask extends TrackedTask {
	hostUrl: string;
}

const STATUS_ORDER: Record<TrackedTask["status"], number> = {
	running: 0,
	failed: 1,
	done: 2,
};

/** Running first, then failed, then done; newest first within each. */
export function sortTasks<
	T extends Pick<TrackedTask, "status" | "createdAt" | "endedAt">,
>(tasks: readonly T[]): T[] {
	return [...tasks].sort(
		(a, b) =>
			STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
			(b.endedAt ?? b.createdAt) - (a.endedAt ?? a.createdAt),
	);
}

export type TaskProgress =
	| { kind: "steps"; done: number; total: number }
	| { kind: "jobs"; done: number; total: number }
	| { kind: "percent"; value: number }
	| { kind: "indeterminate" };

/** How far a task is, by what it reports: steps, CI jobs, a percentage. */
export function taskProgress(
	task: Pick<
		TrackedTask,
		"status" | "steps" | "currentStep" | "progress" | "ci"
	>,
): TaskProgress {
	if (task.steps.length > 0) {
		const done =
			task.status === "done"
				? task.steps.length
				: Math.min(task.currentStep ?? 0, task.steps.length);
		return { kind: "steps", done, total: task.steps.length };
	}
	if (task.ci && task.ci.jobsTotal > 0) {
		return { kind: "jobs", done: task.ci.jobsDone, total: task.ci.jobsTotal };
	}
	if (task.progress !== null) return { kind: "percent", value: task.progress };
	return task.status === "done"
		? { kind: "percent", value: 100 }
		: { kind: "indeterminate" };
}

/** 0 to 1, or null when the task says nothing measurable. */
export function progressFraction(progress: TaskProgress): number | null {
	switch (progress.kind) {
		case "steps":
		case "jobs":
			return progress.total > 0 ? progress.done / progress.total : null;
		case "percent":
			return progress.value / 100;
		default:
			return null;
	}
}

export interface TaskMonitorSummary {
	running: number;
	/** Failed and not archived yet: the button turns red until they are. */
	failed: number;
	/** Mean progress of the running tasks that measure it; null if none do. */
	progress: number | null;
}

export function summarizeTasks(
	tasks: readonly Pick<
		TrackedTask,
		"status" | "steps" | "currentStep" | "progress" | "ci"
	>[],
): TaskMonitorSummary {
	const running = tasks.filter((task) => task.status === "running");
	const fractions = running
		.map((task) => progressFraction(taskProgress(task)))
		.filter((value): value is number => value !== null);
	return {
		running: running.length,
		failed: tasks.filter((task) => task.status === "failed").length,
		progress:
			fractions.length > 0
				? fractions.reduce((sum, value) => sum + value, 0) / fractions.length
				: null,
	};
}

/** `4 min`, `1 h 12`, `2 d`: short enough for a card's corner. */
export function formatElapsed(ms: number): string {
	const minutes = Math.max(0, Math.floor(ms / 60_000));
	if (minutes < 1) return "<1 min";
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		const rest = minutes % 60;
		return rest > 0
			? `${hours} h ${String(rest).padStart(2, "0")}`
			: `${hours} h`;
	}
	return `${Math.floor(hours / 24)} d`;
}

/**
 * The tasks that ended since the last look at the same host, including
 * ones that started and ended in between. The first look only remembers:
 * opening the app must not replay old ends.
 */
export function endedSince(
	previous: ReadonlyMap<string, TrackedTask["status"]> | null,
	tasks: readonly Pick<TrackedTask, "id" | "status">[],
): { failed: string[]; done: string[] } {
	const failed: string[] = [];
	const done: string[] = [];
	if (!previous) return { failed, done };
	for (const task of tasks) {
		const before = previous.get(task.id);
		if (before !== undefined && before !== "running") continue;
		if (task.status === "failed") failed.push(task.id);
		if (task.status === "done") done.push(task.id);
	}
	return { failed, done };
}
