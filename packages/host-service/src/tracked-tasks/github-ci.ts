import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface GithubCiTarget {
	repo: string;
	runId: number | null;
	pullRequest: number | null;
	workflow: string | null;
}

/**
 * A task link the host can follow itself: a GitHub Actions run, or a pull
 * request (its head commit's runs). Null for anything else.
 */
export function parseGithubCiLink(
	link: string,
	workflow: string | null = null,
): GithubCiTarget | null {
	let url: URL;
	try {
		url = new URL(link);
	} catch {
		return null;
	}
	if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
		return null;
	}
	const [owner, name, kind, ...rest] = url.pathname.split("/").filter(Boolean);
	if (!owner || !name) return null;
	const repo = `${owner}/${name}`;
	if (kind === "actions" && rest[0] === "runs" && /^\d+$/.test(rest[1] ?? "")) {
		return { repo, runId: Number(rest[1]), pullRequest: null, workflow };
	}
	if (kind === "pull" && /^\d+$/.test(rest[0] ?? "")) {
		return { repo, runId: null, pullRequest: Number(rest[0]), workflow };
	}
	return null;
}

interface GithubRun {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	html_url: string;
}

interface GithubJob {
	name: string;
	status: string;
	conclusion: string | null;
}

export interface GithubCiRead {
	jobsTotal: number;
	jobsDone: number;
	currentJob: string | null;
	runUrl: string | null;
	/** Set once every followed run has finished. */
	outcome: { status: "done" } | { status: "failed"; reason: string } | null;
}

const FAILED = new Set([
	"failure",
	"timed_out",
	"startup_failure",
	"action_required",
]);

/**
 * Jobs finished over the total across the followed runs, the job running
 * now, and the outcome once all are done. A cancelled or skipped run doesn't
 * fail the task unless nothing else ran: forks often cancel upstream
 * workflows while their own pass.
 */
export function summarizeGithubCi(
	runs: { run: GithubRun; jobs: GithubJob[] }[],
): GithubCiRead {
	const jobs = runs.flatMap((entry) => entry.jobs);
	const running =
		jobs.find((job) => job.status === "in_progress") ??
		jobs.find((job) => job.status !== "completed");
	const runUrl =
		runs.length === 1
			? (runs[0]?.run.html_url ?? null)
			: (runs.find((entry) => entry.run.status !== "completed")?.run.html_url ??
				runs[0]?.run.html_url ??
				null);
	const read: Omit<GithubCiRead, "outcome"> = {
		jobsTotal: jobs.length,
		jobsDone: jobs.filter((job) => job.status === "completed").length,
		currentJob: running?.name ?? null,
		runUrl,
	};
	if (
		runs.length === 0 ||
		runs.some((entry) => entry.run.status !== "completed")
	) {
		return { ...read, outcome: null };
	}
	const failed = runs.filter((entry) => FAILED.has(entry.run.conclusion ?? ""));
	if (failed.length > 0) {
		const reason = failed
			.map(({ run, jobs }) => {
				const names = jobs
					.filter((job) => FAILED.has(job.conclusion ?? ""))
					.map((job) => job.name);
				return names.length > 0 ? `${run.name}: ${names.join(", ")}` : run.name;
			})
			.join("; ");
		return {
			...read,
			outcome: { status: "failed", reason: `Failed: ${reason}` },
		};
	}
	if (runs.every((entry) => entry.run.conclusion !== "success")) {
		return {
			...read,
			outcome: { status: "failed", reason: "The CI run was cancelled" },
		};
	}
	return { ...read, outcome: { status: "done" } };
}

/** Each workflow's latest run: a re-run supersedes the one before it. */
export function latestRunPerWorkflow(
	runs: GithubRun[],
	workflow: string | null,
): GithubRun[] {
	const byName = new Map<string, GithubRun>();
	for (const run of runs) {
		if (workflow && run.name !== workflow) continue;
		const previous = byName.get(run.name);
		if (!previous || run.id > previous.id) byName.set(run.name, run);
	}
	return [...byName.values()];
}

export type GhApi = (path: string) => Promise<unknown>;

export function ghApiWith(env: Record<string, string>): GhApi {
	const execFileAsync = promisify(execFile);
	return async (path) => {
		const { stdout } = await execFileAsync("gh", ["api", path], {
			encoding: "utf8",
			timeout: 20_000,
			maxBuffer: 10 * 1024 * 1024,
			env,
		});
		return JSON.parse(stdout);
	};
}

async function readJobs(api: GhApi, repo: string, runId: number) {
	const page = (await api(
		`repos/${repo}/actions/runs/${runId}/jobs?per_page=100`,
	)) as { jobs?: GithubJob[] };
	return page.jobs ?? [];
}

/** Reads the target's runs and jobs with `gh api`, on a host worker. */
export async function readGithubCi(
	target: GithubCiTarget,
	api: GhApi,
): Promise<GithubCiRead> {
	let runs: GithubRun[];
	if (target.runId !== null) {
		runs = [
			(await api(
				`repos/${target.repo}/actions/runs/${target.runId}`,
			)) as GithubRun,
		];
	} else {
		const pull = (await api(
			`repos/${target.repo}/pulls/${target.pullRequest}`,
		)) as { head?: { sha?: string } };
		const sha = pull.head?.sha;
		if (!sha) throw new Error(`No head commit for PR #${target.pullRequest}`);
		const page = (await api(
			`repos/${target.repo}/actions/runs?head_sha=${sha}&per_page=50`,
		)) as { workflow_runs?: GithubRun[] };
		runs = latestRunPerWorkflow(page.workflow_runs ?? [], target.workflow);
	}
	const withJobs = await Promise.all(
		runs.map(async (run) => ({
			run,
			jobs: await readJobs(api, target.repo, run.id),
		})),
	);
	return summarizeGithubCi(withJobs);
}
