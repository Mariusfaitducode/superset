import type { WorkState, WorkStateInfo } from "@superset/shared/work-state";

export {
	countWorkStates,
	deriveWorkState,
	PINNABLE_WORK_STATES,
	type PinnableWorkState,
	REPORT_TURN_WINDOW_MS,
	SILENT_TURN_MS,
	WORK_STATES,
	type WorkState,
	type WorkStateCause,
	type WorkStateInfo,
	type WorkStateInput,
	type WorkStateMark,
	type WorkStateReport,
	workStateRank,
} from "@superset/shared/work-state";

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
