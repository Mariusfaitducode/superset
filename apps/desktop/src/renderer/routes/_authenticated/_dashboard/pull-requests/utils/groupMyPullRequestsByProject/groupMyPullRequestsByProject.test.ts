import { describe, expect, it } from "bun:test";
import { makeMyPullRequest } from "../myPullRequestFixtures";
import { prioritizeMyPullRequests } from "../prioritizeMyPullRequests";
import type { PullRequestProject } from "../pullRequestProjects";
import { groupMyPullRequestsByProject } from "./groupMyPullRequestsByProject";

const hub = { repoFullName: "spore-bio/hub", projectId: "hub" };
const project = (
	id: string,
	rules: Partial<PullRequestProject> = {},
): PullRequestProject => ({
	id,
	name: id.toUpperCase(),
	labels: [],
	keywords: [],
	pullRequests: [],
	...rules,
});

describe("groupMyPullRequestsByProject", () => {
	const projects = [
		project("registry", { keywords: ["registry"] }),
		project("empty", { keywords: ["nothing matches"] }),
		project("cfr", { keywords: ["audit"] }),
	];

	it("follows the project order, puts Other last and hides empty projects", () => {
		const groups = prioritizeMyPullRequests(
			[
				makeMyPullRequest(1, {}, { ...hub, title: "unrelated" }),
				makeMyPullRequest(2, {}, { ...hub, title: "audit log" }),
				makeMyPullRequest(3, {}, { ...hub, title: "pipeline registry" }),
			],
			{ pinned: [], later: [] },
		);
		const result = groupMyPullRequestsByProject(groups, projects, {});
		expect(result.map((group) => [group.key, group.name])).toEqual([
			["registry", "REGISTRY"],
			["cfr", "CFR"],
			["other", null],
		]);
	});

	it("counts what waits on the viewer but not PRs moved to later", () => {
		const groups = prioritizeMyPullRequests(
			[
				makeMyPullRequest(
					4,
					{ checks: { status: "failure", failed: 1, pending: 0, total: 3 } },
					{ ...hub, title: "registry fix" },
				),
				makeMyPullRequest(
					5,
					{ reviewDecision: "APPROVED" },
					{ ...hub, title: "registry page" },
				),
			],
			{ pinned: [], later: ["spore-bio/hub#5"] },
		);
		const [registry] = groupMyPullRequestsByProject(groups, projects, {});
		expect(registry).toMatchObject({ onViewer: 1, toFix: 1, toMerge: 0 });
		expect(registry?.rows).toHaveLength(2);
	});

	it("puts a PR moved by hand in its new project", () => {
		const groups = prioritizeMyPullRequests(
			[makeMyPullRequest(6, {}, { ...hub, title: "pipeline registry" })],
			{ pinned: [], later: [] },
		);
		const result = groupMyPullRequestsByProject(groups, projects, {
			"spore-bio/hub#6": "cfr",
		});
		expect(result.map((group) => group.key)).toEqual(["cfr"]);
	});
});
