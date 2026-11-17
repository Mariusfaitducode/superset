import { useLingui } from "@lingui/react/macro";
import type { WorkState, WorkStateCause } from "renderer/lib/agent-state";

export interface WorkStateWords {
	/** "Waiting for your answer". */
	label: Record<WorkState, string>;
	/** One or two words, for chips and buttons. */
	short: Record<WorkState, string>;
	/** What it means for the user, in tooltips. */
	hint: Record<WorkState, string>;
	cause: Record<WorkStateCause, string>;
}

/** The words for work states, the same on every surface. */
export function useWorkStateLabels(): WorkStateWords {
	const { t } = useLingui();
	return {
		label: {
			waiting: t`Waiting for your answer`,
			check: t`To check`,
			working: t`Working`,
			todos: t`Resume with its to-dos`,
			resume: t`Resume later`,
			done: t`Done, can be closed`,
		},
		short: {
			waiting: t({ message: "Waiting", context: "work state chip" }),
			check: t({ message: "To check", context: "work state chip" }),
			working: t({ message: "Working", context: "work state chip" }),
			todos: t({ message: "To-dos", context: "work state chip" }),
			resume: t({ message: "Later", context: "work state chip" }),
			done: t({ message: "Done", context: "work state chip" }),
		},
		hint: {
			waiting: t`It asked you something or handed work over: it is your turn.`,
			check: t`Its signals do not add up: look at it before trusting a state.`,
			working: t`Running right now.`,
			todos: t`Unfinished, with a to-do list to pick up.`,
			resume: t`Parked: unfinished, nothing asked of you.`,
			done: t`Finished with nothing left: you can close it.`,
		},
		cause: {
			running: t`Running now`,
			permission: t`Asks for your approval`,
			error: t`Stopped on an error`,
			decision: t`Decision waiting on you`,
			draft: t`Draft waiting for your approval`,
			blocked: t`Blocked, needs you`,
			unread: t`Replied, not read yet`,
			todos: t`Has open to-dos`,
			reportedDone: t`Reported done`,
			read: t`Reply read, nothing asked`,
			notStarted: t`No prompt yet`,
			silent: t`No sign of life for over an hour`,
			pinned: t`Set by hand`,
		},
	};
}
