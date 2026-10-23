import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { HostServiceContext } from "../../../types";
import {
	NOTE_ACTORS,
	NOTE_STATUSES,
	NoteNotFoundError,
	NotePermissionError,
	type WorkspaceNote,
	WorkspaceNoteStore,
} from "../../../workspace-notes";
import { protectedProcedure, router } from "../../index";

let store: WorkspaceNoteStore | null = null;

function getStore(): WorkspaceNoteStore {
	store ??= new WorkspaceNoteStore();
	return store;
}

// Open sidebars and the Notes view refetch on this instead of polling.
function run<T extends WorkspaceNote | WorkspaceNote[]>(
	ctx: HostServiceContext,
	action: () => T,
): T {
	try {
		const result = action();
		const changed = Array.isArray(result) ? result : [result];
		for (const workspaceId of new Set(
			changed.map((note) => note.workspaceId),
		)) {
			ctx.eventBus?.broadcastWorkspaceNotesChanged({
				workspaceId,
				occurredAt: Date.now(),
			});
		}
		return result;
	} catch (error) {
		if (error instanceof NotePermissionError) {
			throw new TRPCError({ code: "FORBIDDEN", message: error.message });
		}
		if (error instanceof NoteNotFoundError) {
			throw new TRPCError({ code: "NOT_FOUND", message: error.message });
		}
		throw error;
	}
}

// The app acts as the user; agents say so through the CLI.
const actor = z.enum(NOTE_ACTORS).default("user");
const text = z.string().trim().min(1).max(1_000);
const details = z.string().max(10_000).nullable();

/**
 * Notes pinned to a workspace, shared by the user and the agents of this
 * host. Kept in a file under the Superset home rather than the host
 * database, so the fork adds no migration to rebase.
 */
export const workspaceNotesRouter = router({
	list: protectedProcedure
		.input(z.object({ workspaceId: z.string().optional() }).default({}))
		.query(({ input }) => getStore().list(input)),

	add: protectedProcedure
		.input(
			z.object({
				actor,
				workspaceId: z.string().min(1),
				items: z
					.array(z.object({ text, details: details.optional() }))
					.min(1)
					.max(200),
			}),
		)
		.mutation(({ ctx, input }) => run(ctx, () => getStore().add(input))),

	update: protectedProcedure
		.input(
			z.object({
				actor,
				id: z.string(),
				text: text.optional(),
				details: details.optional(),
			}),
		)
		.mutation(({ ctx, input: { actor, id, ...fields } }) =>
			run(ctx, () => getStore().update(actor, id, fields)),
		),

	setStatus: protectedProcedure
		.input(z.object({ actor, id: z.string(), status: z.enum(NOTE_STATUSES) }))
		.mutation(({ ctx, input }) =>
			run(ctx, () => getStore().setStatus(input.actor, input.id, input.status)),
		),

	remove: protectedProcedure
		.input(z.object({ actor, id: z.string() }))
		.mutation(({ ctx, input }) =>
			run(ctx, () => getStore().remove(input.actor, input.id)),
		),
});
