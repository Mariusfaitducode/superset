import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	getConversationTodoStore,
	TODO_ACTORS,
	TODO_KINDS,
	TODO_PRIORITIES,
	TodoNotFoundError,
	TodoPermissionError,
} from "../../../conversation-todos";
import type { HostServiceContext } from "../../../types";
import { protectedProcedure, router } from "../../index";

const getStore = getConversationTodoStore;

function run<T>(action: () => T): T {
	try {
		return action();
	} catch (error) {
		if (error instanceof TodoPermissionError) {
			throw new TRPCError({ code: "FORBIDDEN", message: error.message });
		}
		if (error instanceof TodoNotFoundError) {
			throw new TRPCError({ code: "NOT_FOUND", message: error.message });
		}
		throw error;
	}
}

/** Runs a change and tells every client, so none has to poll for it. */
function change<T>(ctx: HostServiceContext, action: () => T): T {
	const result = run(action);
	ctx.eventBus.broadcastHostStoreChanged("conversation-todos");
	return result;
}

// The app acts as the user; agents say so through the CLI.
const actor = z.enum(TODO_ACTORS).default("user");
const text = z.string().trim().min(1).max(1_000);
const dueOn = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
	.nullable();
const link = z
	.url({ protocol: /^https?$/ })
	.max(2_000)
	.nullable();

/**
 * Per-conversation to-dos shared by the user and the agents of this host.
 * Kept in a file under the Superset home rather than the host database, so
 * the fork adds no migration to rebase.
 */
export const conversationTodosRouter = router({
	list: protectedProcedure
		.input(
			z
				.object({
					workspaceId: z.string().optional(),
					terminalId: z.string().optional(),
					archived: z.boolean().optional(),
				})
				.default({}),
		)
		.query(({ input }) => getStore().list(input)),

	add: protectedProcedure
		.input(
			z.object({
				actor,
				workspaceId: z.string().min(1),
				terminalId: z.string().min(1),
				text,
				priority: z.enum(TODO_PRIORITIES).optional(),
				kind: z.enum(TODO_KINDS).optional(),
				dueOn: dueOn.optional(),
				link: link.optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			change(ctx, () =>
				getStore().add({
					...input,
					conversationId:
						ctx.terminalAgentStore.get(input.terminalId)?.agentSessionId ??
						null,
				}),
			),
		),

	update: protectedProcedure
		.input(
			z.object({
				actor,
				id: z.string(),
				text: text.optional(),
				priority: z.enum(TODO_PRIORITIES).optional(),
				kind: z.enum(TODO_KINDS).optional(),
				dueOn: dueOn.optional(),
				link: link.optional(),
			}),
		)
		.mutation(({ ctx, input: { actor, id, ...fields } }) =>
			change(ctx, () => getStore().update(actor, id, fields)),
		),

	setDone: protectedProcedure
		.input(z.object({ actor, id: z.string(), done: z.boolean() }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().setDone(input.actor, input.id, input.done)),
		),

	archive: protectedProcedure
		.input(z.object({ actor, id: z.string() }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().archive(input.actor, input.id)),
		),

	/** The name `archive` had when it deleted; kept for older CLIs and apps. */
	remove: protectedProcedure
		.input(z.object({ actor, id: z.string() }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().archive(input.actor, input.id)),
		),

	restore: protectedProcedure
		.input(z.object({ actor, id: z.string() }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().restore(input.actor, input.id)),
		),

	clearDone: protectedProcedure
		.input(z.object({ actor, terminalId: z.string() }))
		.mutation(({ ctx, input }) =>
			change(ctx, () => getStore().clearDone(input.actor, input.terminalId)),
		),
});
