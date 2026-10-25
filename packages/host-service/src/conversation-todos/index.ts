import { ConversationTodoStore } from "./store";

let shared: ConversationTodoStore | null = null;

/** The host's one store: the router and the conversation watcher share it. */
export function getConversationTodoStore(): ConversationTodoStore {
	shared ??= new ConversationTodoStore();
	return shared;
}

export {
	type ConversationTodo,
	ConversationTodoStore,
	TODO_ACTORS,
	TODO_KINDS,
	TODO_LIMITS,
	TODO_PRIORITIES,
	type TodoActor,
	type TodoKind,
	TodoNotFoundError,
	TodoPermissionError,
	type TodoPriority,
} from "./store";
export { watchAgentConversations } from "./watch-agent-conversations";
