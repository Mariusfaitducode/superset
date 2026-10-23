import { CLIError, string } from "@superset/cli-framework";
import type { CliContext } from "../command";
import type { HostServiceClient } from "../host-target";
import { localHostClient } from "../local-host";

export type TrackedTask = Awaited<
	ReturnType<HostServiceClient["trackedTasks"]["list"]["query"]>
>[number];

/** Which task: the conversation's latest running one unless `--task` names one. */
export const taskOption = {
	task: string().desc(
		"Task ID or the short ID from `tracks list` (default: this conversation's latest running task)",
	),
};

/** The terminal the command runs in, which is what owns its tasks. */
export function trackTerminal(env: NodeJS.ProcessEnv = process.env): {
	workspaceId: string;
	terminalId: string;
} {
	const workspaceId = env.SUPERSET_WORKSPACE_ID;
	const terminalId = env.SUPERSET_TERMINAL_ID;
	if (!workspaceId || !terminalId) {
		throw new CLIError(
			"Not in a Superset terminal",
			"Run `superset track` from an agent's terminal in Superset.",
		);
	}
	return { workspaceId, terminalId };
}

/** Agents run with `SUPERSET_AGENT_ID` set; only the user archives tasks. */
export function trackActor(env: NodeJS.ProcessEnv = process.env) {
	return env.SUPERSET_AGENT_ID ? ("agent" as const) : ("user" as const);
}

/** `"Snapshot, Purge logs,Check"` → three steps. */
export function parseSteps(value: string | undefined): string[] | undefined {
	if (value === undefined) return undefined;
	const steps = value
		.split(",")
		.map((step) => step.trim())
		.filter(Boolean);
	return steps.length > 0 ? steps : undefined;
}

/** Steps are numbered from 1 on the command line, from 0 on the host. */
export function parseStep(value: string): number | string {
	return /^\d+$/.test(value) ? Math.max(0, Number(value) - 1) : value;
}

/** Accepts the short id `tracks list` prints, as long as it is unambiguous. */
export function resolveTaskId(
	idOrPrefix: string,
	tasks: Pick<TrackedTask, "id">[],
	hint = "Run: superset tracks list --all",
): string {
	const matches = tasks.filter((task) => task.id.startsWith(idOrPrefix));
	if (matches.length === 1 && matches[0]) return matches[0].id;
	throw new CLIError(
		matches.length === 0
			? `Task not found: ${idOrPrefix}`
			: `Several tasks start with ${idOrPrefix}`,
		hint,
	);
}

export function progressLabel(task: TrackedTask): string {
	if (task.steps.length > 0 && task.currentStep !== null) {
		const step = Math.min(task.currentStep + 1, task.steps.length);
		return `${step}/${task.steps.length}`;
	}
	if (task.ci && task.ci.jobsTotal > 0) {
		return `${task.ci.jobsDone}/${task.ci.jobsTotal} jobs`;
	}
	return task.progress !== null ? `${task.progress}%` : "";
}

export function taskRows(tasks: TrackedTask[]) {
	return tasks.map((task) => ({
		id: task.id.slice(0, 8),
		status: task.silence ? `${task.status} (silent)` : task.status,
		progress: progressLabel(task),
		title: task.title,
		note: task.failReason ?? task.notes.at(-1)?.text ?? "",
	}));
}

/** Tasks live on the host of this machine, where the agents run. */
export async function localTracksClient(ctx: CliContext) {
	return (await localHostClient(ctx)).trackedTasks;
}

/** Resolves `--task` against this machine's tasks; undefined means "latest". */
export async function taskIdFrom(
	client: Awaited<ReturnType<typeof localTracksClient>>,
	task: string | undefined,
): Promise<string | undefined> {
	if (!task) return undefined;
	return resolveTaskId(task, await client.list.query({}));
}

export function taskMessage(
	verb: string,
	task: TrackedTask | { id: string; title: string },
) {
	return `${verb} ${task.id.slice(0, 8)}: ${task.title}`;
}
