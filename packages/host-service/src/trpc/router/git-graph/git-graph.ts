import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { projects } from "../../../db/schema";
import { createUserSimpleGit } from "../../../runtime/git/simple-git";
import type { HostServiceContext } from "../../../types";
import { protectedProcedure, router } from "../../index";
import {
	countStatusLines,
	type GraphCommit,
	type GraphRef,
	type GraphWorktree,
	LOG_FORMAT,
	parseLog,
	parseRefs,
	parseWorktrees,
	REF_FORMAT,
} from "./parse";

const MAX_COMMITS = 5_000;
const GIT_TIMEOUT_MS = 20_000;

async function resolveRepoPath(
	ctx: HostServiceContext,
	projectId: string,
): Promise<string> {
	const project = ctx.db.query.projects
		.findFirst({ where: eq(projects.id, projectId) })
		.sync();
	if (!project?.repoPath) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "This project has no local repository on this host.",
		});
	}
	try {
		return (
			await createUserSimpleGit(project.repoPath).revparse(["--show-toplevel"])
		).trim();
	} catch (error) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Failed to inspect git repository at ${project.repoPath}`,
			cause: error,
		});
	}
}

export interface GitGraphOverview {
	repoPath: string;
	/** Short name of the checked-out branch of the main checkout. */
	headBranch: string | null;
	refs: GraphRef[];
	worktrees: GraphWorktree[];
	/** Changed files in the main checkout. */
	uncommittedCount: number;
}

export interface GitGraphLog {
	commits: GraphCommit[];
	/** More commits exist past `limit`. */
	hasMore: boolean;
	durationMs: number;
}

export const gitGraphRouter = router({
	overview: protectedProcedure
		.input(z.object({ projectId: z.string() }))
		.query(async ({ ctx, input }): Promise<GitGraphOverview> => {
			const repoPath = await resolveRepoPath(ctx, input.projectId);
			const git = createUserSimpleGit(repoPath, {
				timeout: { block: GIT_TIMEOUT_MS },
			});
			const [refs, worktrees, head, status] = await Promise.all([
				git.raw([
					"for-each-ref",
					`--format=${REF_FORMAT}`,
					"refs/heads",
					"refs/remotes",
					"refs/tags",
				]),
				git.raw(["worktree", "list", "--porcelain"]),
				git.raw(["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(() => ""),
				git
					.raw(["status", "--porcelain", "--untracked-files=normal"])
					.catch(() => ""),
			]);
			return {
				repoPath,
				headBranch: head.trim() || null,
				refs: parseRefs(refs),
				worktrees: parseWorktrees(worktrees),
				uncommittedCount: countStatusLines(status),
			};
		}),

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
		.query(async ({ ctx, input }): Promise<GitGraphLog> => {
			const startedAt = performance.now();
			const repoPath = await resolveRepoPath(ctx, input.projectId);
			const git = createUserSimpleGit(repoPath, {
				timeout: { block: GIT_TIMEOUT_MS },
			});
			const starts =
				input.refs.length > 0
					? input.refs
					: [
							"--branches",
							...(input.includeRemotes ? ["--remotes"] : []),
							...(input.includeTags ? ["--tags"] : []),
							"HEAD",
						];
			// One extra commit tells whether there is more to load.
			const output = await git.raw([
				"log",
				"--topo-order",
				"--decorate=full",
				`--format=${LOG_FORMAT}`,
				`--max-count=${input.limit + 1}`,
				...starts,
				"--",
			]);
			const commits = parseLog(output);
			return {
				commits: commits.slice(0, input.limit),
				hasMore: commits.length > input.limit,
				durationMs: Math.round(performance.now() - startedAt),
			};
		}),
});
