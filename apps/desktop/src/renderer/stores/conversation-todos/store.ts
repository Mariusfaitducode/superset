import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface ConversationTodo {
	id: string;
	text: string;
	done: boolean;
	createdAt: number;
}

/**
 * The user's own checklist per conversation, keyed by terminal id. Kept on
 * this machine only: these are personal notes, not workspace data.
 */
export interface ConversationTodosState {
	todosByConversation: Record<string, ConversationTodo[]>;
	addTodo: (conversationId: string, text: string) => void;
	toggleTodo: (conversationId: string, todoId: string) => void;
	/** An edit to blank text removes the todo. */
	editTodo: (conversationId: string, todoId: string, text: string) => void;
	removeTodo: (conversationId: string, todoId: string) => void;
	clearDone: (conversationId: string) => void;
}

export const MAX_CONVERSATIONS = 100;
export const MAX_TODOS_PER_CONVERSATION = 50;

function lastTouchedAt(list: ConversationTodo[]): number {
	return Math.max(...list.map((todo) => todo.createdAt));
}

// Terminal ids never come back, so the list of the conversation touched
// longest ago goes first once the cap is reached.
function withList(
	state: ConversationTodosState,
	conversationId: string,
	list: ConversationTodo[],
): Pick<ConversationTodosState, "todosByConversation"> {
	const { [conversationId]: _previous, ...rest } = state.todosByConversation;
	if (list.length === 0) return { todosByConversation: rest };
	const others = Object.entries(rest)
		.sort(([, a], [, b]) => lastTouchedAt(b) - lastTouchedAt(a))
		.slice(0, MAX_CONVERSATIONS - 1);
	return {
		todosByConversation: {
			...Object.fromEntries(others),
			[conversationId]: list.slice(-MAX_TODOS_PER_CONVERSATION),
		},
	};
}

export const useConversationTodosStore = create<ConversationTodosState>()(
	devtools(
		persist(
			(set) => ({
				todosByConversation: {},
				addTodo: (conversationId, text) => {
					const trimmed = text.trim();
					if (!trimmed) return;
					set((state) =>
						withList(state, conversationId, [
							...(state.todosByConversation[conversationId] ?? []),
							{
								id: crypto.randomUUID(),
								text: trimmed,
								done: false,
								createdAt: Date.now(),
							},
						]),
					);
				},
				toggleTodo: (conversationId, todoId) => {
					set((state) =>
						withList(
							state,
							conversationId,
							(state.todosByConversation[conversationId] ?? []).map((todo) =>
								todo.id === todoId ? { ...todo, done: !todo.done } : todo,
							),
						),
					);
				},
				editTodo: (conversationId, todoId, text) => {
					const trimmed = text.trim();
					set((state) => {
						const list = state.todosByConversation[conversationId] ?? [];
						return withList(
							state,
							conversationId,
							trimmed
								? list.map((todo) =>
										todo.id === todoId ? { ...todo, text: trimmed } : todo,
									)
								: list.filter((todo) => todo.id !== todoId),
						);
					});
				},
				removeTodo: (conversationId, todoId) => {
					set((state) =>
						withList(
							state,
							conversationId,
							(state.todosByConversation[conversationId] ?? []).filter(
								(todo) => todo.id !== todoId,
							),
						),
					);
				},
				clearDone: (conversationId) => {
					set((state) =>
						withList(
							state,
							conversationId,
							(state.todosByConversation[conversationId] ?? []).filter(
								(todo) => !todo.done,
							),
						),
					);
				},
			}),
			{
				name: "conversation-todos-v1",
				version: 1,
				partialize: (state) => ({
					todosByConversation: state.todosByConversation,
				}),
			},
		),
		{ name: "ConversationTodos" },
	),
);
