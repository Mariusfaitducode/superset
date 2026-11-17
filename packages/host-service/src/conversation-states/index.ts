import { ConversationMarkStore } from "./store";

let shared: ConversationMarkStore | null = null;

/** The host's one store: the router and the turn watcher share it. */
export function getConversationMarkStore(): ConversationMarkStore {
	shared ??= new ConversationMarkStore();
	return shared;
}

export {
	CONVERSATION_MARK_STATES,
	type ConversationMark,
	type ConversationMarkState,
	ConversationMarkStore,
	MARK_ACTORS,
	type MarkActor,
} from "./store";
export {
	applyBindings,
	isNewTurn,
	watchConversationTurns,
} from "./watch-conversation-turns";
