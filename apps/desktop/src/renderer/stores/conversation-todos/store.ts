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

function withList(
	state: ConversationTodosState,
	conversationId: string,
	list: ConversationTodo[],
): Pick<ConversationTodosState, "todosByConversation"> {
	const { [conversationId]: _previous, ...rest } = state.todosByConversation;
	return {
		todosByConversation:
			list.length > 0 ? { ...rest, [conversationId]: list } : rest,
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
