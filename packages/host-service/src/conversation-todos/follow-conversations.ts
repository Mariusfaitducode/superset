import type { ConversationTodoStore } from "./store";

export interface AgentBindingRow {
	terminalId: string;
	workspaceId: string;
	agentSessionId: string | null;
	startedAt: number;
}

export interface ConversationMove {
	conversationId: string;
	terminalId: string;
	workspaceId: string;
	formerTerminalIds: string[];
}

/**
 * One move per agent session: to the terminal it started in last, from every
 * terminal it ran in before (a resume, or the app restarting its agents).
 */
export function planConversationMoves(
	rows: readonly AgentBindingRow[],
): ConversationMove[] {
	const bySession = new Map<string, AgentBindingRow[]>();
	for (const row of rows) {
		if (!row.agentSessionId) continue;
		const list = bySession.get(row.agentSessionId) ?? [];
		list.push(row);
		bySession.set(row.agentSessionId, list);
	}
	return [...bySession].map(([conversationId, list]) => {
		const sorted = [...list].sort((a, b) => a.startedAt - b.startedAt);
		const latest = sorted[sorted.length - 1] as AgentBindingRow;
		return {
			conversationId,
			terminalId: latest.terminalId,
			workspaceId: latest.workspaceId,
			formerTerminalIds: sorted.slice(0, -1).map((row) => row.terminalId),
		};
	});
}

export function followConversations(
	store: ConversationTodoStore,
	rows: readonly AgentBindingRow[],
): number {
	let moved = 0;
	for (const move of planConversationMoves(rows)) {
		moved += store.followConversation(move);
	}
	return moved;
}
