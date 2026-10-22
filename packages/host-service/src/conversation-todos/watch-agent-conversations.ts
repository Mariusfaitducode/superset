import { and, eq, isNotNull } from "drizzle-orm";
import type { HostDb } from "../db";
import { terminalAgentBindings } from "../db/schema.ts";
import type { TerminalAgentStore } from "../terminal-agents/store";
import {
	type AgentBindingRow,
	followConversations,
} from "./follow-conversations";
import type { ConversationTodoStore } from "./store";

function readBindings(db: HostDb, workspaceId?: string): AgentBindingRow[] {
	return db
		.select({
			terminalId: terminalAgentBindings.terminalId,
			workspaceId: terminalAgentBindings.workspaceId,
			agentSessionId: terminalAgentBindings.agentSessionId,
			startedAt: terminalAgentBindings.startedAt,
		})
		.from(terminalAgentBindings)
		.where(
			and(
				isNotNull(terminalAgentBindings.agentSessionId),
				workspaceId
					? eq(terminalAgentBindings.workspaceId, workspaceId)
					: undefined,
			),
		)
		.all();
}

/**
 * Keeps each agent conversation's to-dos on the terminal it runs in. Agents
 * move terminals when they are resumed, by hand or when the app restarts
 * them; without this their to-dos stayed behind on the dead terminal. Runs
 * once at startup to bring back to-dos left behind before, then on every
 * binding change.
 */
export function watchAgentConversations({
	db,
	agentStore,
	todoStore,
}: {
	db: HostDb;
	agentStore: TerminalAgentStore;
	todoStore: ConversationTodoStore;
}): () => void {
	const follow = (workspaceId?: string) => {
		try {
			followConversations(todoStore, readBindings(db, workspaceId));
		} catch (error) {
			console.warn(
				"[conversation-todos] failed to follow conversations",
				error,
			);
		}
	};
	follow();
	const onChange = (workspaceId: string) => follow(workspaceId);
	agentStore.on("change", onChange);
	return () => {
		agentStore.off("change", onChange);
	};
}
