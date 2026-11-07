import { basename } from "node:path";
import { z } from "zod";
import { projects, workspaces } from "../../../db/schema";
import { RETENTION_DAYS } from "../../../insights";
import { insightsSummaryTask } from "../../../workers/tasks/insights";
import { queryProcedure, router } from "../../index";
import { offLoop } from "../../off-loop";

/**
 * How the user drives their agents, measured from the Claude transcripts on
 * this host. The scan is incremental and runs in the worker pool; a first
 * scan that runs out of time returns `complete: false` and resumes on the
 * next call.
 */
export const insightsRouter = router({
	summary: queryProcedure
		.meta({ timeoutMs: 120_000 })
		.input(
			z.object({
				days: z.number().int().min(1).max(RETENTION_DAYS),
				timeZone: z.string().min(1).max(100),
			}),
		)
		.query(
			offLoop({
				task: insightsSummaryTask,
				prepare: ({ ctx, input }) => {
					const projectRows = ctx.db
						.select({
							id: projects.id,
							repoPath: projects.repoPath,
							name: projects.name,
						})
						.from(projects)
						.all();
					const projectNameById = new Map(
						projectRows.map((row) => [
							row.id,
							row.name || basename(row.repoPath),
						]),
					);
					const workspaceRows = ctx.db
						.select({
							worktreePath: workspaces.worktreePath,
							name: workspaces.name,
							projectId: workspaces.projectId,
						})
						.from(workspaces)
						.all();
					const cwdLabels = [
						...workspaceRows.map((row) => ({
							prefix: row.worktreePath,
							label: row.name || basename(row.worktreePath),
							kind: "workspace" as const,
							group: row.projectId
								? (projectNameById.get(row.projectId) ?? null)
								: null,
						})),
						...projectRows.map((row) => ({
							prefix: row.repoPath,
							label: row.name || basename(row.repoPath),
							kind: "project" as const,
							group: row.name || basename(row.repoPath),
						})),
					].filter((label) => label.prefix);
					return {
						days: input.days,
						timeZone: input.timeZone,
						nowMs: Date.now(),
						cwdLabels,
						budgetMs: 60_000,
					};
				},
				options: ({ input }) => ({
					dedupeKey: `insights-summary:${input.days}:${input.timeZone}`,
					timeoutMs: 110_000,
				}),
			}),
		),
});
