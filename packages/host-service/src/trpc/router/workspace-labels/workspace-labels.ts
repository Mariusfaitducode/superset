import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	LABEL_COLORS,
	WorkspaceLabelError,
	WorkspaceLabelStore,
} from "../../../workspace-labels";
import { protectedProcedure, router } from "../../index";

let store: WorkspaceLabelStore | null = null;

function getStore(): WorkspaceLabelStore {
	store ??= new WorkspaceLabelStore();
	return store;
}

function run<T>(action: () => T): T {
	try {
		return action();
	} catch (error) {
		if (error instanceof WorkspaceLabelError) {
			throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
		}
		throw error;
	}
}

const name = z.string().trim().min(1).max(40);
const color = z.enum(LABEL_COLORS);

/** The user's workspace labels on this host, and which workspaces carry them. */
export const workspaceLabelsRouter = router({
	list: protectedProcedure.query(() => getStore().list()),

	createLabel: protectedProcedure
		.input(z.object({ name, color }))
		.mutation(({ input }) =>
			run(() => getStore().createLabel(input.name, input.color)),
		),

	updateLabel: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: name.optional(),
				color: color.optional(),
			}),
		)
		.mutation(({ input: { id, ...fields } }) =>
			run(() => getStore().updateLabel(id, fields)),
		),

	deleteLabel: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ input }) => run(() => getStore().deleteLabel(input.id))),

	/** Replaces the workspace's labels. */
	setWorkspaceLabels: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string().min(1),
				labelIds: z.array(z.string()).max(50),
			}),
		)
		.mutation(({ input }) =>
			getStore().setWorkspaceLabels(input.workspaceId, input.labelIds),
		),
});
