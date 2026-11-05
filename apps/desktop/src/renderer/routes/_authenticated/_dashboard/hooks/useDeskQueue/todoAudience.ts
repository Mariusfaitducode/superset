import type { ConversationTodo } from "renderer/hooks/host-service/useHostConversationTodos";

/**
 * Whether a to-do waits on the user rather than on an agent. The store only
 * records who wrote it (`author`, the same flag the sidebar marks with a bot
 * icon), so:
 * - the user's own to-dos are theirs to do;
 * - an agent's to-do is left for the user (a mail, a review, a decision)
 *   unless it is a `code` one, which agents use to track their own work.
 */
export function isTodoForUser(
	todo: Pick<ConversationTodo, "author" | "kind">,
): boolean {
	if (todo.author !== "agent") return true;
	return todo.kind !== "code";
}
