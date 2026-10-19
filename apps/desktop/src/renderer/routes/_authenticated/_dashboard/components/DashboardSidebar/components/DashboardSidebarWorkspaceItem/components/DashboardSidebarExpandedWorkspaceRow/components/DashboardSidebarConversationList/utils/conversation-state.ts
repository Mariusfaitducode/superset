/**
 * A conversation's state as the sidebar shows it. Unlike the workspace status
 * (`deriveTerminalAgentStatus`), a finished turn does not fall back to idle once
 * seen: it becomes `seen` and stays that way until the user starts a new turn.
 */
export type ConversationState =
	| "working"
	| "request"
	| "failed"
	| "unseen"
	| "seen"
	| "idle";

export function deriveConversationState({
	lastEventType,
	lastEventAt,
	lastSeenAt,
}: {
	lastEventType: string;
	lastEventAt: number;
	/** Host-clock mark from the notification store, like `lastEventAt`. */
	lastSeenAt: number | undefined;
}): ConversationState {
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

export function formatWaited(waitedMs: number): string {
	const minutes = Math.floor(Math.max(0, waitedMs) / 60_000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}
