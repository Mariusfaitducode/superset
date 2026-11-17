import type { ConversationStateInput } from "./agent-state";

/**
 * Where a conversation stands for the user, beyond its live lifecycle: is
 * the ball in their court, is it parked, does it have a to-do list to pick
 * up, or can it be closed. Most urgent first.
 */
export const WORK_STATES = [
	"waiting",
	"check",
	"working",
	"todos",
	"resume",
	"done",
] as const;
export type WorkState = (typeof WORK_STATES)[number];

/** The states a user or agent can pin; a running agent is always working. */
export const PINNABLE_WORK_STATES = [
	"waiting",
	"todos",
	"resume",
	"done",
] as const satisfies readonly WorkState[];
export type PinnableWorkState = (typeof PINNABLE_WORK_STATES)[number];

/** Why the state was inferred, shown next to it. */
export type WorkStateCause =
	| "running"
	| "permission"
	| "error"
	| "decision"
	| "draft"
	| "blocked"
	| "unread"
	| "todos"
	| "reportedDone"
	| "read"
	| "notStarted"
	| "silent"
	| "pinned";

export interface WorkStateMark {
	state: PinnableWorkState;
	setBy: "user" | "agent";
	setAt: number;
}

export interface WorkStateReport {
	kind: "done" | "decision" | "draft" | "blocked" | "progress";
	status: "open" | "answered" | "dismissed";
	createdAt: number;
}

export interface WorkStateInput {
	conversation: ConversationStateInput;
	/** When the conversation entered its lifecycle state (host clock). */
	since: number;
	openTodos: number;
	/** This conversation's reports, any status. */
	reports: readonly WorkStateReport[];
	mark: WorkStateMark | null;
	/** Subagents or workflow agents run under it; they speak for it. */
	hasChildren: boolean;
	/** Now, on the host clock `since` uses. */
	now: number;
}

export interface WorkStateInfo {
	state: WorkState;
	cause: WorkStateCause;
	/** Set when a pin decides the state. */
	mark: WorkStateMark | null;
	/** What the app would show without the pin. */
	inferred: { state: WorkState; cause: WorkStateCause };
}

/**
 * A report speaks for the latest turn only. Agents file it as they finish,
 * just before their turn stops, so it counts when it was created at most
 * this long before that stop (or after it). An older one, even still open
 * on the Desk, belongs to a turn the agent has moved past.
 */
export const REPORT_TURN_WINDOW_MS = 10 * 60_000;

/**
 * Every tool call re-stamps a running agent. A turn silent for longer than
 * this may have lost its process without a stop: it is shown "to check"
 * rather than working.
 */
export const SILENT_TURN_MS = 60 * 60_000;

const WAITING_REPORTS = ["decision", "draft", "blocked"] as const;

function belongsToLastTurn(report: WorkStateReport, since: number): boolean {
	return report.createdAt >= since - REPORT_TURN_WINDOW_MS;
}

function infer(input: Omit<WorkStateInput, "mark">): WorkStateInfo["inferred"] {
	const { conversation, since } = input;
	if (conversation === "working") {
		return !input.hasChildren && input.now - since > SILENT_TURN_MS
			? { state: "check", cause: "silent" }
			: { state: "working", cause: "running" };
	}
	if (conversation === "request")
		return { state: "waiting", cause: "permission" };
	if (conversation === "failed") return { state: "waiting", cause: "error" };
	const current = input.reports.filter((report) =>
		belongsToLastTurn(report, since),
	);
	for (const kind of WAITING_REPORTS) {
		if (
			current.some((report) => report.kind === kind && report.status === "open")
		) {
			return { state: "waiting", cause: kind };
		}
	}
	if (conversation === "unseen") return { state: "waiting", cause: "unread" };
	if (input.openTodos > 0) return { state: "todos", cause: "todos" };
	// Acknowledged on the Desk or not, a DONE of the last turn still holds.
	if (current.some((report) => report.kind === "done")) {
		return { state: "done", cause: "reportedDone" };
	}
	if (conversation === "seen") return { state: "resume", cause: "read" };
	return { state: "resume", cause: "notStarted" };
}

/**
 * The one derivation every surface uses (Office, sidebar, to-dos panel).
 * Only the conversation's own signals count, never its workspace's labels.
 * A pin wins while the agent is not running a turn; the host drops the pin
 * when the agent starts its next turn (a prompt after a stop or an error),
 * and inference takes over again.
 */
export function deriveWorkState(input: WorkStateInput): WorkStateInfo {
	const inferred = infer(input);
	if (
		input.mark &&
		inferred.state !== "working" &&
		inferred.state !== "check"
	) {
		return {
			state: input.mark.state,
			cause: "pinned",
			mark: input.mark,
			inferred,
		};
	}
	return { ...inferred, mark: null, inferred };
}

export function workStateRank(state: WorkState): number {
	return WORK_STATES.indexOf(state);
}

/**
 * Same palette as the live states: amber for you, yellow at work, green when
 * finished, grey when parked; to-do lists get their own blue, and a state
 * the signals cannot vouch for its own muted violet.
 */
export function workStateColorVar(
	info: Pick<WorkStateInfo, "state" | "cause">,
) {
	if (info.cause === "error") return "var(--sb-state-failed)";
	return WORK_STATE_COLOR_VAR[info.state];
}

export const WORK_STATE_COLOR_VAR: Record<WorkState, string> = {
	waiting: "var(--sb-state-needsYou)",
	check: "var(--sb-state-check)",
	working: "var(--sb-state-working)",
	todos: "var(--sb-state-todos)",
	resume: "var(--sb-state-idle)",
	done: "var(--sb-state-unseen)",
};

/** Count per state, in `WORK_STATES` order, for filter chips. */
export function countWorkStates(
	states: Iterable<WorkState>,
): Record<WorkState, number> {
	const counts = Object.fromEntries(
		WORK_STATES.map((state) => [state, 0]),
	) as Record<WorkState, number>;
	for (const state of states) counts[state] += 1;
	return counts;
}
