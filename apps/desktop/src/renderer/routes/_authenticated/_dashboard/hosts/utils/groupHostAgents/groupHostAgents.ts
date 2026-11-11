import { deriveTerminalAgentStatus } from "renderer/hooks/host-service/useTerminalAgentStatuses";
import {
	AGENT_STATES,
	type AgentState,
	agentStateFromPaneStatus,
	countLiveChildren,
	mostUrgentAgentState,
} from "renderer/lib/agent-state";
import type { PaneStatus } from "shared/tabs-types";

export interface HostAgentBinding {
	terminalId: string;
	workspaceId: string;
	agentId: string;
	lastEventType: string;
	lastEventAt: number;
	endedAt?: number;
	subagents?: { lastEventAt?: number }[];
}

export interface HostWorkspaceRef {
	id: string;
	name: string;
	branch: string;
}

export interface HostAgentView {
	terminalId: string;
	agentId: string;
	/** The terminal's title when the host gives one. */
	title: string | null;
	state: AgentState;
	lastEventAt: number;
	subagentCount: number;
}

export interface HostWorkspaceGroup<Workspace extends HostWorkspaceRef> {
	workspace: Workspace;
	agents: HostAgentView[];
	state: AgentState;
}

/** A live binding's status, the same way the sidebar derives it. */
export function bindingPaneStatus(
	binding: HostAgentBinding,
	terminalSeenAt: Readonly<Record<string, number>>,
): PaneStatus {
	return deriveTerminalAgentStatus({
		lastEventType: binding.lastEventType,
		lastEventAt: binding.lastEventAt,
		lastSeenAt: terminalSeenAt[binding.terminalId],
		liveChildren: countLiveChildren(binding),
	});
}

function urgency(state: AgentState): number {
	return AGENT_STATES.indexOf(state);
}

/**
 * The host's workspaces with their live agents, most urgent first, then the
 * most recent; workspaces with no live agent come apart, in the given order.
 */
export function groupHostAgents<Workspace extends HostWorkspaceRef>({
	workspaces,
	bindings,
	terminalSeenAt,
	titles,
}: {
	workspaces: readonly Workspace[];
	bindings: Iterable<HostAgentBinding>;
	terminalSeenAt: Readonly<Record<string, number>>;
	titles: ReadonlyMap<string, string>;
}): {
	withAgents: HostWorkspaceGroup<Workspace>[];
	withoutAgents: Workspace[];
} {
	const agentsByWorkspace = new Map<string, HostAgentView[]>();
	for (const binding of bindings) {
		if (binding.endedAt != null) continue;
		const status = bindingPaneStatus(binding, terminalSeenAt);
		const agents = agentsByWorkspace.get(binding.workspaceId) ?? [];
		agents.push({
			terminalId: binding.terminalId,
			agentId: binding.agentId,
			title: titles.get(binding.terminalId) ?? null,
			state: agentStateFromPaneStatus(status === "idle" ? null : status),
			lastEventAt: binding.lastEventAt,
			subagentCount: binding.subagents?.length ?? 0,
		});
		agentsByWorkspace.set(binding.workspaceId, agents);
	}

	const withAgents: HostWorkspaceGroup<Workspace>[] = [];
	const withoutAgents: Workspace[] = [];
	for (const workspace of workspaces) {
		const agents = agentsByWorkspace.get(workspace.id);
		if (!agents) {
			withoutAgents.push(workspace);
			continue;
		}
		agents.sort(
			(a, b) =>
				urgency(a.state) - urgency(b.state) || b.lastEventAt - a.lastEventAt,
		);
		withAgents.push({
			workspace,
			agents,
			state: mostUrgentAgentState(agents.map((agent) => agent.state)),
		});
	}
	withAgents.sort(
		(a, b) =>
			urgency(a.state) - urgency(b.state) ||
			(b.agents[0]?.lastEventAt ?? 0) - (a.agents[0]?.lastEventAt ?? 0),
	);
	return { withAgents, withoutAgents };
}
