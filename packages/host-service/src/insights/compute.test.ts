import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeTranscriptInsights, type InsightsSummary } from "./index";
import { writeSyntheticTranscripts } from "./test-fixtures/synthetic-transcripts";

// Expected numbers come from running ~/Documents/agent-workflow-analysis
// (extract.py, sessions.py, metrics.py) on the same synthetic fixture.
describe("computeTranscriptInsights on the synthetic fixture", () => {
	let dir: string;
	let summary: InsightsSummary;

	beforeAll(async () => {
		dir = mkdtempSync(join(tmpdir(), "insights-"));
		writeSyntheticTranscripts(join(dir, "projects"));
		summary = await computeTranscriptInsights({
			days: 14,
			timeZone: "Europe/Paris",
			nowMs: Date.parse("2026-10-14T20:00:00Z"),
			cwdLabels: [
				{
					prefix: "/Users/marius/CodeProjects/superset",
					label: "superset",
					kind: "project",
					group: "Superset",
				},
			],
			root: join(dir, "projects"),
			cachePath: join(dir, "cache.json"),
		});
	});

	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	test("counts the typed messages of each day like the scripts", () => {
		const byDay = Object.fromEntries(
			summary.days
				.filter((day) => day.messages > 0)
				.map((day) => [day.day, day.messages]),
		);
		expect(byDay).toEqual({
			"2026-10-01": 25,
			"2026-10-02": 24,
			"2026-10-05": 22,
			"2026-10-06": 24,
			"2026-10-07": 24,
			"2026-10-08": 21,
			"2026-10-09": 19,
			"2026-10-12": 28,
			"2026-10-13": 27,
			"2026-10-14": 21,
		});
		expect(summary.totals.duplicatesDropped).toBe(163);
	});

	test("matches the scripts' daytime reply time and message shares", () => {
		const week = summary.weeks.find((row) => row.weekStart === "2026-10-12");
		expect(week?.replies).toBe(67);
		expect((week?.replyMedianSec ?? 0) / 60).toBeCloseTo(7.4, 1);
		expect(week?.goAheadShare).toBeCloseTo(0.24, 2);
		expect(week?.statusCheckShare).toBeCloseTo(0.38, 2);
		expect(week?.correctionShare).toBeCloseTo(0.25, 2);
		expect(week?.pastedShare).toBeCloseTo(0.07, 2);
		expect(week?.messagesPerWorkingDay).toBeCloseTo(76 / 3, 5);
	});

	test("measures agents working and waiting in daytime slots", () => {
		const week = summary.weeks.find((row) => row.weekStart === "2026-10-12");
		expect(week?.meanWorking).toBeCloseTo(0.9, 1);
		expect(week?.meanWaiting).toBeCloseTo(0.45, 1);
		expect(week?.peakWorking).toBe(2);
		expect(week?.liveSessionsPerWorkingDay).toBe(3);
	});

	test("attributes messages to known projects, falling back to the folder", () => {
		expect(summary.projects.map((project) => project.name).sort()).toEqual([
			"Superset",
			"hub",
			"spore-app",
		]);
		const total = summary.projects.reduce((sum, row) => sum + row.share, 0);
		expect(total).toBeCloseTo(1, 5);
	});
});
