/**
 * The conversation and work states every surface shows (Office, sidebar,
 * to-dos panel) and the CLI reports, from the same live signals. Pure, so
 * the app and `superset observer snapshot` run the one derivation.
 */

/**
 * A conversation's state as the sidebar shows it. Unlike the workspace status,
 * a finished turn does not fall back to idle once seen: it becomes `seen` and
 * stays that way until the user starts a new turn.
 */
export const CONVERSATION_STATES = [
	"working",
	"request",
	"failed",
	"unseen",
	"seen",
	"idle",
] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

export function deriveConversationState({
	lastEventType,
	lastEventAt,
	lastSeenAt,
	liveChildren = 0,
}: {
	lastEventType: string;
	lastEventAt: number;
	/** Host-clock mark from the notification store, like `lastEventAt`. */
	lastSeenAt: number | undefined;
	/** Subagents and workflow agents still running (`countLiveChildren`). */
	liveChildren?: number;
}): ConversationState {
	const state = parentState(lastEventType, lastEventAt, lastSeenAt);
	// A finished or quiet parent whose children still run is not done yet.
	if (
		liveChildren > 0 &&
		(state === "unseen" || state === "seen" || state === "idle")
	) {
		return "working";
	}
	return state;
}

function parentState(
	lastEventType: string,
	lastEventAt: number,
	lastSeenAt: number | undefined,
): ConversationState {
	switch (lastEventType) {
		case "Start":
			return "working";
		case "PermissionRequest":
			return "request";
		case "Failed":
			return "failed";
		case "Stop":
			return lastEventAt > (lastSeenAt ?? 0) ? "unseen" : "seen";
		default:
			return "idle";
	}
}

/** A child quiet since before its parent's last event outlived an interrupt. */
const CHILD_GRACE_MS = 5_000;

/**
 * Subagents and workflow agents still running under an agent. A parent that
 * handed its turn back while they run is still at work. Only children heard
 * from since the parent's last event count, so one left over by an interrupt
 * (its stop never arrives) does not keep a stopped parent at work.
 */
export function countLiveChildren(binding: {
	lastEventAt: number;
	subagents?: readonly { lastEventAt?: number }[];
	backgroundTasks?: readonly { kind: string }[];
}): number {
	const since = binding.lastEventAt - CHILD_GRACE_MS;
	return (
		(binding.subagents?.filter(
			(subagent) =>
				subagent.lastEventAt === undefined || subagent.lastEventAt >= since,
		).length ?? 0) +
		(binding.backgroundTasks?.filter((task) => task.kind === "subagent")
			.length ?? 0)
	);
}

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
	conversation: ConversationState;
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
 * The one derivation every surface uses (Office, sidebar, to-dos panel, the
 * observer's snapshot). Only the conversation's own signals count, never its
 * workspace's labels. A pin wins while the agent is not running a turn; the
 * host drops the pin when the agent starts its next turn (a prompt after a
 * stop or an error), and inference takes over again.
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
