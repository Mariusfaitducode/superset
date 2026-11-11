import type { ActivePaneStatus } from "shared/tabs-types";

/**
 * The five states every agent surface shows, most urgent first. One color
 * each (`--sb-state-*`), whatever the cause: a question, a permission or a
 * Desk report all read as `needsYou`.
 */
export const AGENT_STATES = [
	"failed",
	"needsYou",
	"unseen",
	"working",
	"idle",
] as const;
export type AgentState = (typeof AGENT_STATES)[number];

/** The conversation states `deriveConversationState` returns. */
export type ConversationStateInput =
	| "working"
	| "request"
	| "failed"
	| "unseen"
	| "seen"
	| "idle";

const FROM_CONVERSATION: Record<ConversationStateInput, AgentState> = {
	working: "working",
	request: "needsYou",
	failed: "failed",
	unseen: "unseen",
	// Opened once: nothing new to see.
	seen: "idle",
	idle: "idle",
};

export function agentStateFromConversation(
	state: ConversationStateInput,
): AgentState {
	return FROM_CONVERSATION[state];
}

const FROM_PANE_STATUS: Record<ActivePaneStatus, AgentState> = {
	permission: "needsYou",
	failed: "failed",
	working: "working",
	review: "unseen",
};

export function agentStateFromPaneStatus(
	status: ActivePaneStatus | null | undefined,
): AgentState {
	return status ? FROM_PANE_STATUS[status] : "idle";
}

export function mostUrgentAgentState(
	states: Iterable<AgentState | null | undefined>,
): AgentState {
	let best = AGENT_STATES.length - 1;
	for (const state of states) {
		if (!state) continue;
		const rank = AGENT_STATES.indexOf(state);
		if (rank < best) best = rank;
	}
	return AGENT_STATES[best];
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

/** Counted in "Needs you": the agent cannot go on without the user. */
export function isBlockedOnUser(state: AgentState): boolean {
	return state === "needsYou" || state === "failed";
}

export function agentStateColorVar(state: AgentState): string {
	return `var(--sb-state-${state})`;
}

export const AGENT_STATE_DOT_CLASS: Record<AgentState, string> = {
	failed: "bg-[var(--sb-state-failed)]",
	needsYou: "bg-[var(--sb-state-needsYou)]",
	unseen: "bg-[var(--sb-state-unseen)]",
	working: "bg-[var(--sb-state-working)] animate-pulse",
	idle: "bg-[var(--sb-state-idle)]",
};
