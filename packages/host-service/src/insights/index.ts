import type { CwdLabel } from "../trpc/router/usage/history/aggregate";
import { computeInsights, type InsightsSummary } from "./compute";
import { scanTranscripts } from "./scan";

export type {
	DeskInsights,
	InsightsDay,
	InsightsProject,
	InsightsSummary,
	InsightsWeek,
} from "./compute";
export { computeInsights } from "./compute";
export { RETENTION_DAYS, scanTranscripts } from "./scan";

export interface TranscriptInsightsInput {
	days: number;
	timeZone: string;
	nowMs: number;
	cwdLabels: CwdLabel[];
	root?: string;
	cachePath?: string;
	budgetMs?: number;
}

export async function computeTranscriptInsights(
	input: TranscriptInsightsInput,
): Promise<InsightsSummary> {
	const { cache, complete } = await scanTranscripts({
		root: input.root,
		cachePath: input.cachePath,
		nowMs: input.nowMs,
		budgetMs: input.budgetMs,
	});
	return computeInsights(cache, { ...input, complete });
}
