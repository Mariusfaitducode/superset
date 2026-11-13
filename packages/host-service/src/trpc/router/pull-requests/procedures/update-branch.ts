import { z } from "zod";
import { protectedProcedure } from "../../../index";
import { actionRejectionError } from "../../github/github";
import { resolveGithubRepo } from "../../workspace-creation/shared/project-helpers";

/** Merge the base branch into the PR branch on GitHub, like its "Update branch" button. */
export const updateBranch = protectedProcedure
	.input(
		z.object({
			projectId: z.string(),
			prNumber: z.number().int().positive(),
		}),
	)
	.mutation(async ({ ctx, input }) => {
		const repo = await resolveGithubRepo(ctx, input.projectId);
		const octokit = await ctx.github();
		try {
			const { data } = await octokit.pulls.updateBranch({
				owner: repo.owner,
				repo: repo.name,
				pull_number: input.prNumber,
			});
			return { message: data.message ?? null };
		} catch (error) {
			throw actionRejectionError(error, "GitHub refused to update the branch.");
		}
	});
