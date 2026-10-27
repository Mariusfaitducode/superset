import { describe, expect, it } from "bun:test";
import { makeMyPullRequest } from "../myPullRequestFixtures";
import { prioritizeMyPullRequests } from "../prioritizeMyPullRequests";
import { groupMyPullRequestsByProject } from "./groupMyPullRequestsByProject";

const hub = { repoFullName: "spore-bio/hub", projectId: "hub" };
const fork = { repoFullName: "acme/fork", projectId: "fork" };

describe("groupMyPullRequestsByProject", () => {
	it("puts the project with the most PRs on the viewer first and keeps action order inside", () => {
		const groups = prioritizeMyPullRequests(
			[
				makeMyPullRequest(1, { reviewDecision: "APPROVED" }, fork),
				makeMyPullRequest(
					2,
					{ checks: { status: "failure", failed: 1, pending: 0, total: 3 } },
					hub,
				),
				makeMyPullRequest(
					3,
					{ viewerIsAuthor: false, reviewRequestedFromViewer: true },
					hub,
				),
				makeMyPullRequest(
					4,
					{ reviewDecision: "REVIEW_REQUIRED", pendingReviewers: ["vic"] },
					fork,
				),
			],
			{ pinned: [], later: [] },
		);
		const projects = groupMyPullRequestsByProject(groups);
		expect(projects.map((project) => project.repoFullName)).toEqual([
			"spore-bio/hub",
			"acme/fork",
		]);
		expect(projects[0]?.rows.map((row) => row.pr.prNumber)).toEqual([3, 2]);
		expect(projects[0]).toMatchObject({ onViewer: 2, toReview: 1, toFix: 1 });
		expect(projects[1]).toMatchObject({ onViewer: 1, toMerge: 1 });
	});

	it("does not count PRs moved to later", () => {
		const groups = prioritizeMyPullRequests(
			[makeMyPullRequest(5, { reviewDecision: "APPROVED" }, hub)],
			{ pinned: [], later: ["spore-bio/hub#5"] },
		);
		expect(groupMyPullRequestsByProject(groups)[0]).toMatchObject({
			onViewer: 0,
			toMerge: 0,
		});
	});
});
