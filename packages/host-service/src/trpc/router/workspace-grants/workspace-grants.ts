import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	GRANT_ACTORS,
	GRANT_IDS,
	GrantPermissionError,
	WORKSPACE_GRANTS,
	WorkspaceGrantStore,
} from "../../../workspace-grants";
import { protectedProcedure, router } from "../../index";

let store: WorkspaceGrantStore | null = null;

function getStore(): WorkspaceGrantStore {
	store ??= new WorkspaceGrantStore();
	return store;
}

/**
 * What the user lets each workspace's agents do without asking, on this
 * host. `available` ships the catalog so an older CLI shows new grants.
 */
export const workspaceGrantsRouter = router({
	list: protectedProcedure.query(() => ({
		available: WORKSPACE_GRANTS.map((grant) => ({ ...grant })),
		workspaces: getStore().list(),
	})),

	/** Replaces the workspace's grants. */
	set: protectedProcedure
		.input(
			z.object({
				// The app acts as the user; agents say so through the CLI.
				actor: z.enum(GRANT_ACTORS).default("user"),
				actorWorkspaceId: z.string().optional(),
				workspaceId: z.string().min(1),
				grants: z.array(z.enum(GRANT_IDS)).max(GRANT_IDS.length),
			}),
		)
		.mutation(({ input }) => {
			try {
				return getStore().set(input);
			} catch (error) {
				if (error instanceof GrantPermissionError) {
					throw new TRPCError({ code: "FORBIDDEN", message: error.message });
				}
				throw error;
			}
		}),
});
