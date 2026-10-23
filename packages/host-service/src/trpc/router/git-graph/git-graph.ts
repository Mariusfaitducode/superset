import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { projects } from "../../../db/schema";
import type { HostServiceContext } from "../../../types";
import {
	gitGraphLogTask,
	gitGraphOverviewTask,
} from "../../../workers/tasks/git";
import { protectedProcedure, router } from "../../index";
import { offLoop } from "../../off-loop";

const MAX_COMMITS = 5_000;

function projectRepoPath(ctx: HostServiceContext, projectId: string): string {
	const project = ctx.db.query.projects
		.findFirst({ where: eq(projects.id, projectId) })
		.sync();
	if (!project?.repoPath) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "This project has no local repository on this host.",
		});
	}
	return project.repoPath;
}

// Git runs in the worker pool: a 5000-commit log must not stall the loop.
export const gitGraphRouter = router({
	overview: protectedProcedure.input(z.object({ projectId: z.string() })).query(
		offLoop({
			task: gitGraphOverviewTask,
			prepare: ({ ctx, input }) => ({
				repoPath: projectRepoPath(ctx, input.projectId),
			}),
		}),
	),

	log: protectedProcedure
		.input(
			z.object({
				projectId: z.string(),
				/** Full ref names to walk from; empty walks every branch. */
				refs: z
					.array(z.string().regex(/^refs\/(heads|remotes|tags)\//))
					.max(200),
				includeRemotes: z.boolean(),
				includeTags: z.boolean(),
				limit: z.number().int().min(1).max(MAX_COMMITS),
			}),
		)
		.query(
			offLoop({
				task: gitGraphLogTask,
				prepare: ({ ctx, input }) => ({
					repoPath: projectRepoPath(ctx, input.projectId),
					refs: input.refs,
					includeRemotes: input.includeRemotes,
					includeTags: input.includeTags,
					limit: input.limit,
				}),
			}),
		),
});
