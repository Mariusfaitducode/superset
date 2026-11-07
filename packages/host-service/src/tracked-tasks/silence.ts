import {
	type AgentRunState,
	agentRunState,
} from "@superset/shared/agent-status";
import type { TerminalAgentBinding } from "../terminal-agents/types";
import type { TrackedTask } from "./store";

export type SilenceReason =
	| "no-news"
	| "agent-gone"
	| "agent-idle"
	| "agent-blocked"
	| "ci-unreachable";

/** How long an agent may sit idle on a running task before it reads as silent. */
export const IDLE_GRACE_MS = 2 * 60_000;

/**
 * Why a running task looks abandoned, or null. The agent state is the one
 * the sidebar shows (the live binding's last hook event). A task whose CI
 * the host follows needs no agent and no news; it reads as silent only
 * when GitHub stops answering.
 */
export function silenceOf(
	task: TrackedTask,
	agent: Pick<TerminalAgentBinding, "lastEventType" | "lastEventAt"> | null,
	now: number,
): SilenceReason | null {
	if (task.status !== "running") return null;
	const quietFor = now - task.updatedAt;
	const threshold = task.silenceAfterMinutes * 60_000;
	if (task.ci) {
		return task.ci.error && quietFor > threshold ? "ci-unreachable" : null;
	}
	if (!agent) return "agent-gone";
	const state: AgentRunState = agentRunState(agent.lastEventType);
	const idleFor = now - Math.max(agent.lastEventAt, task.updatedAt);
	if (state === "blocked" && idleFor > IDLE_GRACE_MS) return "agent-blocked";
	if (state === "idle" && idleFor > IDLE_GRACE_MS) return "agent-idle";
	return quietFor > threshold ? "no-news" : null;
}

/** The live agent of a task's conversation, wherever it was resumed to. */
export function findTaskAgent<
	T extends Pick<TerminalAgentBinding, "terminalId" | "agentSessionId">,
>(task: TrackedTask, live: readonly T[]): T | null {
	if (task.conversationId) {
		const resumed = live.find(
			(binding) => binding.agentSessionId === task.conversationId,
		);
		if (resumed) return resumed;
	}
	return live.find((binding) => binding.terminalId === task.terminalId) ?? null;
}
