import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const TRACKED_TASK_STATUSES = ["running", "done", "failed"] as const;
export type TrackedTaskStatus = (typeof TRACKED_TASK_STATUSES)[number];

export interface TrackedTaskNote {
	at: number;
	text: string;
}

/** What the host last read of the GitHub Actions run a task links to. */
export interface TrackedTaskCi {
	repo: string;
	/** The run the link names, or null when it names a pull request. */
	runId: number | null;
	pullRequest: number | null;
	/** Only this workflow's runs, when the agent named one. */
	workflow: string | null;
	jobsTotal: number;
	jobsDone: number;
	currentJob: string | null;
	/** The run itself, once found: the PR's latest run has a link of its own. */
	runUrl: string | null;
	checkedAt: number | null;
	/** Why the last read failed; cleared by the next good one. */
	error: string | null;
}

export interface TrackedTask {
	id: string;
	workspaceId: string;
	/** The terminal the agent ran in when it started the task. */
	terminalId: string;
	/** The agent's session id, which survives a resume into a new terminal. */
	conversationId: string | null;
	title: string;
	steps: string[];
	/** Index into `steps`; the ones before it are done. */
	currentStep: number | null;
	/** 0-100, when the agent reports a percentage. */
	progress: number | null;
	status: TrackedTaskStatus;
	notes: TrackedTaskNote[];
	link: string | null;
	ci: TrackedTaskCi | null;
	/** Minutes without news before the task reads as silent. */
	silenceAfterMinutes: number;
	failReason: string | null;
	createdAt: number;
	/** The last news from the agent or the CI, which silence is measured from. */
	updatedAt: number;
	endedAt: number | null;
	/** Closing a card archives it: the task is kept, out of the panel. */
	archivedAt: number | null;
	archivedBy: "user" | null;
}

/** Who calls: the app as the user, or an agent from its terminal. */
export type TrackedTaskCaller =
	| { actor: "user" }
	| { actor: "agent"; terminalId: string; conversationId: string | null };

export class TrackedTaskPermissionError extends Error {}
export class TrackedTaskNotFoundError extends Error {}

export const MAX_TASKS = 500;
export const MAX_NOTES = 30;
export const MAX_STEPS = 30;
export const DEFAULT_SILENCE_MINUTES = 15;

interface TrackedTaskFile {
	version: 1;
	tasks: TrackedTask[];
}

export function defaultTrackedTasksPath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "tracked-tasks.json");
}

export interface StartInput {
	workspaceId: string;
	terminalId: string;
	conversationId: string | null;
	title: string;
	steps?: string[];
	link?: string | null;
	ci?: TrackedTaskCi | null;
	silenceAfterMinutes?: number;
}

/**
 * The long-running work agents follow with `superset track`, in one JSON
 * file the app and the agents' CLI both go through. Only the conversation
 * that started a task moves it forward; only the user archives it, so a card
 * stays in the panel until the user has seen it. Nothing is deleted.
 */
export class TrackedTaskStore {
	private tasks: TrackedTask[] | null = null;

	constructor(
		private readonly filePath: string = defaultTrackedTasksPath(),
		private readonly now: () => number = Date.now,
	) {}

	list(
		filter: {
			workspaceId?: string;
			terminalId?: string;
			archived?: boolean;
		} = {},
	): TrackedTask[] {
		const archived = filter.archived ?? false;
		return this.load().filter(
			(task) =>
				(task.archivedAt !== null) === archived &&
				(!filter.workspaceId || task.workspaceId === filter.workspaceId) &&
				(!filter.terminalId || task.terminalId === filter.terminalId),
		);
	}

	get(id: string): TrackedTask {
		const task = this.load().find((item) => item.id === id);
		if (!task) throw new TrackedTaskNotFoundError(`Task not found: ${id}`);
		return task;
	}

	start(input: StartInput): TrackedTask {
		const title = input.title.trim();
		if (!title) throw new Error("A task needs a title");
		const steps = (input.steps ?? [])
			.map((step) => step.trim())
			.filter(Boolean)
			.slice(0, MAX_STEPS);
		const at = this.now();
		const task: TrackedTask = {
			id: randomUUID(),
			workspaceId: input.workspaceId,
			terminalId: input.terminalId,
			conversationId: input.conversationId,
			title,
			steps,
			currentStep: steps.length > 0 ? 0 : null,
			progress: null,
			status: "running",
			notes: [],
			link: input.link ?? null,
			ci: input.ci ?? null,
			silenceAfterMinutes: input.silenceAfterMinutes ?? DEFAULT_SILENCE_MINUTES,
			failReason: null,
			createdAt: at,
			updatedAt: at,
			endedAt: null,
			archivedAt: null,
			archivedBy: null,
		};
		this.save([...this.load(), task]);
		return task;
	}

	/**
	 * The task an agent means when it names none: its conversation's latest
	 * running one.
	 */
	latestRunning(caller: TrackedTaskCaller): TrackedTask {
		const own = this.load().filter(
			(task) =>
				task.status === "running" &&
				task.archivedAt === null &&
				this.owns(caller, task),
		);
		// Later in the file is newer when two started in the same millisecond.
		const latest = own.reduce<TrackedTask | undefined>(
			(best, task) => (!best || task.createdAt >= best.createdAt ? task : best),
			undefined,
		);
		if (!latest) {
			throw new TrackedTaskNotFoundError(
				"No running task in this conversation",
			);
		}
		return latest;
	}

	/** Moves to a step, by 0-based index or by name; the ones before are done. */
	step(
		caller: TrackedTaskCaller,
		id: string,
		step: number | string,
		note?: string,
	): TrackedTask {
		const task = this.running(caller, id);
		const index =
			typeof step === "number"
				? step
				: task.steps.findIndex(
						(name) => name.toLowerCase() === step.trim().toLowerCase(),
					);
		if (index < 0 || index >= task.steps.length) {
			throw new Error(
				task.steps.length === 0
					? "This task has no steps"
					: `No such step: ${step}. Steps: ${task.steps.join(", ")}`,
			);
		}
		return this.touch({ ...task, currentStep: index }, note);
	}

	progress(
		caller: TrackedTaskCaller,
		id: string,
		percent: number,
		note?: string,
	): TrackedTask {
		const task = this.running(caller, id);
		const progress = Math.round(Math.min(100, Math.max(0, percent)));
		return this.touch({ ...task, progress }, note);
	}

	note(caller: TrackedTaskCaller, id: string, text: string): TrackedTask {
		const task = this.running(caller, id);
		if (!text.trim()) throw new Error("A note needs some text");
		return this.touch(task, text);
	}

	setLink(
		caller: TrackedTaskCaller,
		id: string,
		link: string | null,
		ci: TrackedTaskCi | null,
	): TrackedTask {
		const task = this.running(caller, id);
		return this.touch({ ...task, link, ci });
	}

	finish(
		caller: TrackedTaskCaller,
		id: string,
		outcome:
			| { status: "done"; note?: string }
			| { status: "failed"; reason: string },
	): TrackedTask {
		const task = this.running(caller, id);
		return this.end(task, outcome);
	}

	/** The host's own reads of a followed CI run; no ownership to check. */
	recordCi(
		id: string,
		ci: TrackedTaskCi,
		outcome?: { status: "done" } | { status: "failed"; reason: string },
	): TrackedTask {
		const task = this.get(id);
		if (task.status !== "running") return task;
		const news =
			ci.jobsDone !== task.ci?.jobsDone ||
			ci.currentJob !== task.ci?.currentJob ||
			ci.jobsTotal !== task.ci?.jobsTotal;
		const next: TrackedTask = {
			...task,
			ci,
			updatedAt: news ? this.now() : task.updatedAt,
		};
		if (outcome) return this.end(next, outcome);
		return this.replace(next);
	}

	archive(caller: TrackedTaskCaller, id: string): TrackedTask {
		this.assertUser(caller, "archive");
		const task = this.get(id);
		if (task.archivedAt !== null) return task;
		return this.replace({
			...task,
			archivedAt: this.now(),
			archivedBy: "user",
		});
	}

	restore(caller: TrackedTaskCaller, id: string): TrackedTask {
		this.assertUser(caller, "restore");
		const task = this.get(id);
		if (task.archivedAt === null) return task;
		return this.replace({ ...task, archivedAt: null, archivedBy: null });
	}

	private end(
		task: TrackedTask,
		outcome:
			| { status: "done"; note?: string }
			| { status: "failed"; reason: string },
	): TrackedTask {
		const at = this.now();
		const ended: TrackedTask = {
			...task,
			status: outcome.status,
			endedAt: at,
			updatedAt: at,
			...(outcome.status === "done"
				? {
						progress: task.progress === null ? null : 100,
						currentStep: task.steps.length > 0 ? task.steps.length : null,
					}
				: { failReason: outcome.reason.trim() || "Failed" }),
		};
		const note = outcome.status === "done" ? outcome.note : outcome.reason;
		return this.replace(withNote(ended, note, at));
	}

	private touch(task: TrackedTask, note?: string): TrackedTask {
		const at = this.now();
		return this.replace(withNote({ ...task, updatedAt: at }, note, at));
	}

	private running(caller: TrackedTaskCaller, id: string): TrackedTask {
		const task = this.get(id);
		if (!this.owns(caller, task)) {
			throw new TrackedTaskPermissionError(
				"Only the conversation that started a task can update it",
			);
		}
		if (task.status !== "running") {
			throw new Error(`This task is already ${task.status}`);
		}
		return task;
	}

	private owns(caller: TrackedTaskCaller, task: TrackedTask): boolean {
		if (caller.actor === "user") return false;
		return (
			caller.terminalId === task.terminalId ||
			(caller.conversationId !== null &&
				caller.conversationId === task.conversationId)
		);
	}

	private assertUser(caller: TrackedTaskCaller, action: string): void {
		if (caller.actor === "user") return;
		throw new TrackedTaskPermissionError(
			`Only the user can ${action} a task: its card stays until they close it`,
		);
	}

	private replace(task: TrackedTask): TrackedTask {
		this.save(this.load().map((item) => (item.id === task.id ? task : item)));
		return task;
	}

	private load(): TrackedTask[] {
		if (this.tasks) return this.tasks;
		try {
			const file = JSON.parse(
				readFileSync(this.filePath, "utf8"),
			) as TrackedTaskFile;
			this.tasks = Array.isArray(file.tasks) ? file.tasks : [];
		} catch {
			this.tasks = [];
		}
		return this.tasks;
	}

	private save(tasks: TrackedTask[]): void {
		this.tasks = bound(tasks);
		mkdirSync(dirname(this.filePath), { recursive: true });
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		try {
			const file: TrackedTaskFile = { version: 1, tasks: this.tasks };
			writeFileSync(temporaryPath, JSON.stringify(file, null, "\t"));
			renameSync(temporaryPath, this.filePath);
		} catch (error) {
			try {
				unlinkSync(temporaryPath);
			} catch {
				// Best-effort cleanup after a failed write or rename.
			}
			throw error;
		}
	}
}

function withNote(
	task: TrackedTask,
	text: string | undefined,
	at: number,
): TrackedTask {
	const trimmed = text?.trim();
	if (!trimmed) return task;
	return {
		...task,
		notes: [...task.notes, { at, text: trimmed }].slice(-MAX_NOTES),
	};
}

// Past the cap the oldest archived tasks go first; open cards are never
// dropped for archived ones.
function bound(tasks: TrackedTask[]): TrackedTask[] {
	if (tasks.length <= MAX_TASKS) return tasks;
	const archived = tasks
		.filter((task) => task.archivedAt !== null)
		.sort((a, b) => (a.archivedAt ?? 0) - (b.archivedAt ?? 0));
	const drop = new Set(archived.slice(0, tasks.length - MAX_TASKS));
	return tasks.filter((task) => !drop.has(task));
}
