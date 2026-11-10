import { agentStatusFromEvent } from "@superset/shared/agent-status";
import type { PaneStatus } from "shared/tabs-types";

/**
 * Derive a terminal agent's UI status from its host binding. `permission` is
 * deliberately not seen-gated — it's a live blocking state that must show
 * until the agent resolves it.
 */
export function deriveTerminalAgentStatus({
	lastEventType,
	lastEventAt,
	lastSeenAt,
	liveChildren = 0,
}: {
	lastEventType: string;
	lastEventAt: number;
	lastSeenAt: number | undefined;
	/** Subagents and workflow agents still running (`countLiveChildren`). */
	liveChildren?: number;
}): PaneStatus {
	const status = agentStatusFromEvent(lastEventType);
	if (liveChildren > 0 && (status === "review" || !status)) {
		return "working";
	}
	if (status === "review") {
		return lastEventAt > (lastSeenAt ?? 0) ? "review" : "idle";
	}
	return status ?? "idle";
}
