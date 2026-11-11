import {
	agentStateFromConversation,
	countLiveChildren,
	isBlockedOnUser,
} from "renderer/lib/agent-state";
import { deriveConversationState } from "../DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";

export interface NeedsYouBinding {
	terminalId: string;
	lastEventType: string;
	lastEventAt: number;
	/** Live children keep a finished parent at work (`countLiveChildren`). */
	subagents?: readonly { lastEventAt?: number }[];
	backgroundTasks?: readonly { kind: string }[];
}

export interface NeedsYouTodo {
	workspaceId: string;
	terminalId: string;
	done: boolean;
	priority?: string | null;
}

export interface NeedsYouReport {
	workspaceId: string;
	terminalId: string;
	kind: string;
	status: string;
}

/** Desk report kinds that wait on the user; `done` and `progress` do not. */
const WAITING_REPORT_KINDS = new Set(["decision", "draft", "blocked"]);

export interface NeedsYouTarget {
	workspaceId: string;
	terminalId: string;
	/** Host clock, ms; the longest waiting comes first. */
	since: number;
}

export interface NeedsYouSummary {
	/** Conversations that cannot go on without the user. */
	agents: number;
	/** Open high-priority to-dos of live conversations. */
	todos: number;
	/** Open Desk reports of live conversations awaiting a decision, a draft or a blocker. */
	reports: number;
	/** Where a click goes, in turn. */
	targets: NeedsYouTarget[];
}

export function summarizeNeedsYou({
	workspaces,
	terminalSeenAt,
	todos,
	reports = [],
}: {
	workspaces: Iterable<{ id: string; bindings: Iterable<NeedsYouBinding> }>;
	terminalSeenAt: Readonly<Record<string, number>>;
	todos: Iterable<NeedsYouTodo>;
	reports?: Iterable<NeedsYouReport>;
}): NeedsYouSummary {
	const live = new Map<string, NeedsYouTarget>();
	const targets = new Map<string, NeedsYouTarget>();
	let agents = 0;
	for (const workspace of workspaces) {
		for (const binding of workspace.bindings) {
			const target = {
				workspaceId: workspace.id,
				terminalId: binding.terminalId,
				since: binding.lastEventAt,
			};
			live.set(binding.terminalId, target);
			const state = agentStateFromConversation(
				deriveConversationState({
					lastEventType: binding.lastEventType,
					lastEventAt: binding.lastEventAt,
					lastSeenAt: terminalSeenAt[binding.terminalId],
					liveChildren: countLiveChildren(binding),
				}),
			);
			if (isBlockedOnUser(state)) {
				agents += 1;
				targets.set(binding.terminalId, target);
			}
		}
	}
	let urgentTodos = 0;
	for (const todo of todos) {
		if (todo.done || todo.priority !== "high") continue;
		const target = live.get(todo.terminalId);
		if (!target || target.workspaceId !== todo.workspaceId) continue;
		urgentTodos += 1;
		if (!targets.has(todo.terminalId)) targets.set(todo.terminalId, target);
	}
	let waitingReports = 0;
	for (const report of reports) {
		if (report.status !== "open" || !WAITING_REPORT_KINDS.has(report.kind)) {
			continue;
		}
		const target = live.get(report.terminalId);
		if (!target || target.workspaceId !== report.workspaceId) continue;
		waitingReports += 1;
		if (!targets.has(report.terminalId)) {
			targets.set(report.terminalId, target);
		}
	}
	return {
		agents,
		todos: urgentTodos,
		reports: waitingReports,
		targets: [...targets.values()].sort(
			(a, b) => a.since - b.since || a.terminalId.localeCompare(b.terminalId),
		),
	};
}

/** The target after the last one opened, wrapping around. */
export function nextNeedsYouTarget(
	targets: NeedsYouTarget[],
	lastTerminalId: string | null,
): NeedsYouTarget | null {
	if (targets.length === 0) return null;
	const last = targets.findIndex(
		(target) => target.terminalId === lastTerminalId,
	);
	return targets[(last + 1) % targets.length] ?? null;
}
