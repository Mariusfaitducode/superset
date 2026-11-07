import type { GithubCiRead, GithubCiTarget } from "./github-ci";
import type { TrackedTask, TrackedTaskStore } from "./store";

export const CI_POLL_INTERVAL_MS = 45_000;

/**
 * Follows the GitHub Actions run of every running task that links one, so
 * the agent doesn't have to loop on it: jobs done over the total, the job
 * running now, then done or failed. Reads one task at a time, only while
 * some task is running, through `readCi` (a host worker in production).
 */
export class TrackedTaskCiWatcher {
	private timer: ReturnType<typeof setInterval> | null = null;
	private ticking = false;

	constructor(
		private readonly deps: {
			store: TrackedTaskStore;
			readCi: (target: GithubCiTarget) => Promise<GithubCiRead>;
			onChange: () => void;
			now?: () => number;
			intervalMs?: number;
		},
	) {}

	start(): () => void {
		this.timer ??= setInterval(
			() => void this.tick(),
			this.deps.intervalMs ?? CI_POLL_INTERVAL_MS,
		);
		// The poll never keeps the host alive on its own.
		this.timer.unref?.();
		void this.tick();
		return () => this.stop();
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	/** Reads every followed run now; a new task's first read can't wait. */
	async tick(): Promise<void> {
		if (this.ticking) return;
		this.ticking = true;
		try {
			for (const task of this.followed()) await this.check(task);
		} finally {
			this.ticking = false;
		}
	}

	private followed(): TrackedTask[] {
		return this.deps.store
			.list()
			.filter((task) => task.status === "running" && task.ci !== null);
	}

	private async check(task: TrackedTask): Promise<void> {
		const ci = task.ci;
		if (!ci) return;
		const now = (this.deps.now ?? Date.now)();
		let after: TrackedTask;
		try {
			const read = await this.deps.readCi({
				repo: ci.repo,
				runId: ci.runId,
				pullRequest: ci.pullRequest,
				workflow: ci.workflow,
			});
			after = this.deps.store.recordCi(
				task.id,
				{
					...ci,
					jobsTotal: read.jobsTotal,
					jobsDone: read.jobsDone,
					currentJob: read.currentJob,
					runUrl: read.runUrl ?? ci.runUrl,
					checkedAt: now,
					error: null,
				},
				read.outcome ?? undefined,
			);
		} catch (error) {
			after = this.deps.store.recordCi(task.id, {
				...ci,
				checkedAt: now,
				error: error instanceof Error ? error.message : String(error),
			});
		}
		if (visiblyChanged(task, after)) this.deps.onChange();
	}
}

// `checkedAt` moves on every read; clients only hear of what they show.
function visiblyChanged(before: TrackedTask, after: TrackedTask): boolean {
	const shown = (task: TrackedTask) =>
		JSON.stringify([task.status, { ...task.ci, checkedAt: null }]);
	return shown(before) !== shown(after);
}
