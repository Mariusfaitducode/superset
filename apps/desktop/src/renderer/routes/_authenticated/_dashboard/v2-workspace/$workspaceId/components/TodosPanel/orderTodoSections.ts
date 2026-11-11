export interface TodoSection<Conversation, Todo> {
	conversation: Conversation;
	todos: Todo[];
	focused: boolean;
}

/**
 * The conversations the to-dos panel lists: the focused one first, even
 * without to-dos so one can be added, then every other that has some, in
 * the workspace's order. Agents' own to-dos count only when shown.
 */
export function orderTodoSections<
	Conversation extends { terminalId: string },
	Todo extends { author?: string | null },
>({
	conversations,
	todosByTerminal,
	focusedTerminalId,
	includeAgentTodos,
}: {
	conversations: readonly Conversation[];
	todosByTerminal: ReadonlyMap<string, Todo[]>;
	focusedTerminalId: string | null;
	includeAgentTodos: boolean;
}): TodoSection<Conversation, Todo>[] {
	const sections: TodoSection<Conversation, Todo>[] = [];
	for (const conversation of conversations) {
		const all = todosByTerminal.get(conversation.terminalId) ?? [];
		const todos = includeAgentTodos
			? all
			: all.filter((todo) => todo.author !== "agent");
		const focused = conversation.terminalId === focusedTerminalId;
		if (!focused && todos.length === 0) continue;
		const section = { conversation, todos, focused };
		if (focused) sections.unshift(section);
		else sections.push(section);
	}
	return sections;
}
