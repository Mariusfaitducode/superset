export interface OpenTodoCount {
	open: number;
	/** Some open one is high priority. */
	urgent: boolean;
}

/** Open to-dos of a workspace's live conversations, as its rows list them. */
export function countOpenTodos({
	todos,
	workspaceId,
	liveTerminalIds,
	includeAgentTodos,
}: {
	todos: Iterable<{
		workspaceId: string;
		terminalId: string;
		done: boolean;
		priority?: string | null;
		author?: string | null;
	}>;
	workspaceId: string;
	liveTerminalIds: ReadonlySet<string> | { has(id: string): boolean };
	includeAgentTodos: boolean;
}): OpenTodoCount {
	let open = 0;
	let urgent = false;
	for (const todo of todos) {
		if (todo.done || todo.workspaceId !== workspaceId) continue;
		if (!liveTerminalIds.has(todo.terminalId)) continue;
		if (!includeAgentTodos && todo.author === "agent") continue;
		open += 1;
		if (todo.priority === "high") urgent = true;
	}
	return { open, urgent };
}
