import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { AgentState } from "renderer/lib/agent-state";

export const AGENT_STATE_LABEL: Record<AgentState, MessageDescriptor> = {
	needsYou: msg`Needs you`,
	working: msg`Working`,
	unseen: msg`Done, not seen yet`,
	failed: msg`Failed or blocked`,
	idle: msg`Idle`,
};
