import type { PaneStatus } from "shared/tabs-types";

export interface HostAgentCounts {
	working: number;
	/** Blocked on a question, a permission or an error. */
	needsYou: number;
	idle: number;
}

export interface HostSummary {
	machineId: string;
	name: string;
	isOnline: boolean;
	isLocal: boolean;
	counts: HostAgentCounts;
}

interface SummarizeHostsInput {
	hosts: ReadonlyArray<{ machineId: string; name: string; isOnline: boolean }>;
	localMachineId: string | null;
	workspaces: ReadonlyArray<{ id: string; hostId: string }>;
	/** `workspaceId → terminalId → agent status`, one entry per agent. */
	agentStatuses: (workspaceId: string) => Iterable<PaneStatus> | undefined;
}

function emptyCounts(): HostAgentCounts {
	return { working: 0, needsYou: 0, idle: 0 };
}

function addStatus(counts: HostAgentCounts, status: PaneStatus): void {
	if (status === "working") counts.working += 1;
	else if (status === "permission" || status === "failed") counts.needsYou += 1;
	else counts.idle += 1;
}

/**
 * One entry per host with its agents counted by state: this device first,
 * then online hosts, then by name. `total` counts every workspace given,
 * including cloud ones that belong to no host of the roster.
 */
export function summarizeHosts({
	hosts,
	localMachineId,
	workspaces,
	agentStatuses,
}: SummarizeHostsInput): { hosts: HostSummary[]; total: HostAgentCounts } {
	const byHost = new Map<string, HostAgentCounts>(
		hosts.map((host) => [host.machineId, emptyCounts()]),
	);
	const total = emptyCounts();
	const seen = new Set<string>();
	for (const workspace of workspaces) {
		if (seen.has(workspace.id)) continue;
		seen.add(workspace.id);
		const hostCounts = byHost.get(workspace.hostId);
		for (const status of agentStatuses(workspace.id) ?? []) {
			addStatus(total, status);
			if (hostCounts) addStatus(hostCounts, status);
		}
	}
	const summaries = hosts.map(
		(host): HostSummary => ({
			machineId: host.machineId,
			name: host.name,
			isOnline: host.isOnline,
			isLocal: host.machineId === localMachineId,
			counts: byHost.get(host.machineId) ?? emptyCounts(),
		}),
	);
	summaries.sort(
		(a, b) =>
			Number(b.isLocal) - Number(a.isLocal) ||
			Number(b.isOnline) - Number(a.isOnline) ||
			a.name.localeCompare(b.name),
	);
	return { hosts: summaries, total };
}
