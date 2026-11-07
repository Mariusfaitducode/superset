import { describe, expect, test } from "bun:test";
import {
	type GhApi,
	latestRunPerWorkflow,
	parseGithubCiLink,
	readGithubCi,
	summarizeGithubCi,
} from "./github-ci";

const run = (
	id: number,
	name: string,
	status = "completed",
	conclusion: string | null = "success",
) => ({
	id,
	name,
	status,
	conclusion,
	html_url: `https://github.com/o/r/actions/runs/${id}`,
});
const job = (name: string, status = "completed", conclusion = "success") => ({
	name,
	status,
	conclusion: status === "completed" ? conclusion : null,
});

describe("parseGithubCiLink", () => {
	test("reads a run, a job of a run, and a pull request", () => {
		expect(
			parseGithubCiLink(
				"https://github.com/Mariusfaitducode/superset/actions/runs/39809208774",
			),
		).toEqual({
			repo: "Mariusfaitducode/superset",
			runId: 39809208774,
			pullRequest: null,
			workflow: null,
		});
		expect(
			parseGithubCiLink("https://github.com/o/r/actions/runs/12/job/34")?.runId,
		).toBe(12);
		expect(
			parseGithubCiLink("https://github.com/o/r/pull/25/checks", "Fork CI"),
		).toEqual({
			repo: "o/r",
			runId: null,
			pullRequest: 25,
			workflow: "Fork CI",
		});
	});

	test("ignores anything else", () => {
		expect(parseGithubCiLink("https://github.com/o/r")).toBeNull();
		expect(parseGithubCiLink("https://grafana.local/d/1")).toBeNull();
		expect(parseGithubCiLink("not a url")).toBeNull();
	});
});

describe("summarizeGithubCi", () => {
	test("counts jobs and names the one running", () => {
		expect(
			summarizeGithubCi([
				{
					run: run(1, "Fork CI", "in_progress", null),
					jobs: [
						job("Lint and i18n"),
						job("Typecheck", "in_progress"),
						job("Test", "queued"),
					],
				},
			]),
		).toEqual({
			jobsTotal: 3,
			jobsDone: 1,
			currentJob: "Typecheck",
			runUrl: "https://github.com/o/r/actions/runs/1",
			outcome: null,
		});
	});

	test("fails with the failed jobs, ignoring cancelled upstream runs", () => {
		const read = summarizeGithubCi([
			{ run: run(1, "CI", "completed", "cancelled"), jobs: [] },
			{
				run: run(2, "Fork CI", "completed", "failure"),
				jobs: [job("Test", "completed", "failure"), job("Typecheck")],
			},
		]);
		expect(read.outcome).toEqual({
			status: "failed",
			reason: "Failed: Fork CI: Test",
		});
	});

	test("passes when what ran passed, fails when everything was cancelled", () => {
		expect(
			summarizeGithubCi([
				{ run: run(1, "CI", "completed", "cancelled"), jobs: [] },
				{ run: run(2, "Fork CI"), jobs: [job("Test")] },
			]).outcome,
		).toEqual({ status: "done" });
		expect(
			summarizeGithubCi([
				{ run: run(1, "CI", "completed", "cancelled"), jobs: [] },
			]).outcome?.status,
		).toBe("failed");
	});

	test("waits while a PR has no run yet", () => {
		expect(summarizeGithubCi([]).outcome).toBeNull();
	});
});

describe("latestRunPerWorkflow", () => {
	test("keeps each workflow's re-run, and only the named workflow", () => {
		const runs = [run(1, "Fork CI"), run(3, "Fork CI"), run(2, "CI")];
		expect(latestRunPerWorkflow(runs, null).map((r) => r.id)).toEqual([3, 2]);
		expect(latestRunPerWorkflow(runs, "Fork CI").map((r) => r.id)).toEqual([3]);
	});
});

describe("readGithubCi", () => {
	test("follows a PR's head commit runs through gh api", async () => {
		const calls: string[] = [];
		const api: GhApi = async (path) => {
			calls.push(path);
			if (path === "repos/o/r/pulls/25") return { head: { sha: "abc" } };
			if (path.startsWith("repos/o/r/actions/runs?head_sha=abc")) {
				return {
					workflow_runs: [
						run(10, "Fork CI", "in_progress", null),
						run(11, "CI"),
					],
				};
			}
			if (path === "repos/o/r/actions/runs/10/jobs?per_page=100") {
				return { jobs: [job("Lint"), job("Test", "in_progress")] };
			}
			throw new Error(`unexpected ${path}`);
		};
		const read = await readGithubCi(
			{ repo: "o/r", runId: null, pullRequest: 25, workflow: "Fork CI" },
			api,
		);
		expect(read).toMatchObject({
			jobsTotal: 2,
			jobsDone: 1,
			currentJob: "Test",
		});
		expect(calls).toHaveLength(3);
	});
});
