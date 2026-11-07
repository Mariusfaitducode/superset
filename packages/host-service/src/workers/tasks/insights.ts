// insights/* worker tasks. The first scan reads every Claude transcript of
// the last weeks (GBs on heavy users), so it must stay off the event loop.

import {
	computeTranscriptInsights,
	type InsightsSummary,
	type TranscriptInsightsInput,
} from "../../insights/index.ts";
import { defineWorkerTask } from "../define-worker-task.ts";

export const insightsSummaryTask = defineWorkerTask<
	TranscriptInsightsInput,
	InsightsSummary
>({
	type: "insights/summary",
	handler: (input) => computeTranscriptInsights(input),
});

export const insightsTasks = [insightsSummaryTask];
