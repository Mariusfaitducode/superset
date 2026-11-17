import { z } from "zod";
import {
	CONVERSATION_MARK_STATES,
	getConversationMarkStore,
	MARK_ACTORS,
} from "../../../conversation-states";
import type { HostServiceContext } from "../../../types";
import { protectedProcedure, router } from "../../index";

function change<T>(ctx: HostServiceContext, action: () => T): T {
	const result = action();
	ctx.eventBus.broadcastHostStoreChanged("conversation-states");
	return result;
}

// The app acts as the user; agents say so through the CLI.
const actor = z.enum(MARK_ACTORS).default("user");

/**
 * The state pinned on a conversation (waiting, resume later, resume with its
 * to-dos, done), over the one the app infers. Kept in a file under the
 * Superset home like to-dos, so agents read the same through the CLI.
 */
export const conversationStatesRouter = router({
	list: protectedProcedure
		.input(
			z
				.object({
					workspaceId: z.string().optional(),
					terminalId: z.string().optional(),
				})
				.default({}),
		)
		.query(({ input }) => getConversationMarkStore().list(input)),

	set: protectedProcedure
		.input(
			z.object({
				actor,
				workspaceId: z.string().min(1),
				terminalId: z.string().min(1),
				state: z.enum(CONVERSATION_MARK_STATES),
			}),
		)
		.mutation(({ ctx, input }) =>
			change(ctx, () =>
				getConversationMarkStore().set({
					...input,
					conversationId:
						ctx.terminalAgentStore.get(input.terminalId)?.agentSessionId ??
						null,
				}),
			),
		),

	clear: protectedProcedure
		.input(z.object({ terminalId: z.string().min(1) }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getConversationMarkStore().clear(input.terminalId)),
		),
});
