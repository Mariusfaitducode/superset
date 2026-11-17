import type { ConversationState } from "@superset/shared/work-state";

export {
	CONVERSATION_STATES,
	type ConversationState,
	deriveConversationState,
} from "@superset/shared/work-state";

export function isWaitingOnUser(state: ConversationState): boolean {
	return (
		state === "unseen" ||
		state === "seen" ||
		state === "request" ||
		state === "failed"
	);
}

const TINT_THRESHOLDS_MS = [10 * 60_000, 60 * 60_000, 4 * 60 * 60_000];

/** 0 (fresh) to 3 (has waited for hours). */
export function waitingTintLevel(waitedMs: number): 0 | 1 | 2 | 3 {
	let level = 0;
	for (const threshold of TINT_THRESHOLDS_MS) {
		if (waitedMs >= threshold) level += 1;
	}
	return level as 0 | 1 | 2 | 3;
}
