import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	IDEA_ACTORS,
	IDEA_STATUSES,
	IdeaNotFoundError,
	IdeaPermissionError,
	WorkspaceIdeaStore,
} from "../../../workspace-ideas";
import { protectedProcedure, router } from "../../index";

let store: WorkspaceIdeaStore | null = null;

function getStore(): WorkspaceIdeaStore {
	store ??= new WorkspaceIdeaStore();
	return store;
}

function run<T>(action: () => T): T {
	try {
		return action();
	} catch (error) {
		if (error instanceof IdeaPermissionError) {
			throw new TRPCError({ code: "FORBIDDEN", message: error.message });
		}
		if (error instanceof IdeaNotFoundError) {
			throw new TRPCError({ code: "NOT_FOUND", message: error.message });
		}
		throw error;
	}
}

// The app acts as the user; agents say so through the CLI.
const actor = z.enum(IDEA_ACTORS).default("user");
const text = z.string().trim().min(1).max(1_000);
const note = z.string().max(10_000).nullable();

/**
 * Ideas pinned to a workspace, shared by the user and the agents of this
 * host. Kept in a file under the Superset home rather than the host
 * database, so the fork adds no migration to rebase.
 */
export const workspaceIdeasRouter = router({
	list: protectedProcedure
		.input(z.object({ workspaceId: z.string().optional() }).default({}))
		.query(({ input }) => getStore().list(input)),

	add: protectedProcedure
		.input(
			z.object({
				actor,
				workspaceId: z.string().min(1),
				items: z
					.array(z.object({ text, note: note.optional() }))
					.min(1)
					.max(200),
			}),
		)
		.mutation(({ input }) => run(() => getStore().add(input))),

	update: protectedProcedure
		.input(
			z.object({
				actor,
				id: z.string(),
				text: text.optional(),
				note: note.optional(),
			}),
		)
		.mutation(({ input: { actor, id, ...fields } }) =>
			run(() => getStore().update(actor, id, fields)),
		),

	setStatus: protectedProcedure
		.input(z.object({ actor, id: z.string(), status: z.enum(IDEA_STATUSES) }))
		.mutation(({ input }) =>
			run(() => getStore().setStatus(input.actor, input.id, input.status)),
		),

	remove: protectedProcedure
		.input(z.object({ actor, id: z.string() }))
		.mutation(({ input }) =>
			run(() => getStore().remove(input.actor, input.id)),
		),
});
