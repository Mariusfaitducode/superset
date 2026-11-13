import { describe, expect, it } from "bun:test";
import { makeMyPullRequest } from "../myPullRequestFixtures";
import { prioritizeMyPullRequests } from "../prioritizeMyPullRequests";
import { pickTodayPullRequests } from "./pickTodayPullRequests";

const theirs = { viewerIsAuthor: false, reviewRequestedFromViewer: true };

const pullRequests = [
	makeMyPullRequest(1, { pendingReviewers: ["carol"] }),
	makeMyPullRequest(2, {
		checks: { status: "failure", failed: 1, pending: 0, total: 4 },
	}),
	makeMyPullRequest(3, theirs, { authorLogin: "alice" }),
	makeMyPullRequest(4, { reviewDecision: "APPROVED" }),
	makeMyPullRequest(5, {
		reviewDecision: "APPROVED",
		behindBase: true,
		baseRefName: "develop",
	}),
	makeMyPullRequest(6, {}),
	makeMyPullRequest(
		7,
		{
			viewerIsAuthor: false,
			authorActiveSinceViewerReview: true,
			viewerLastReview: {
				state: "COMMENTED",
				submittedAt: "2026-10-10T00:00:00Z",
				onHead: false,
			},
		},
		{ authorLogin: "pb" },
	),
];

const pick = (overrides = { pinned: [] as string[], later: [] as string[] }) =>
	pickTodayPullRequests(prioritizeMyPullRequests(pullRequests, overrides)).map(
		(item) => [item.row.pr.prNumber, item.verb],
	);

describe("pickTodayPullRequests", () => {
	it("leads with merges, then reviews, fixes and PRs with no reviewer", () => {
		expect(pick()).toEqual([
			[4, "merge"],
			[5, "update"],
			[3, "review"],
			[7, "re-review"],
			[2, "fix"],
		]);
	});

	it("puts pinned PRs first, drops later ones, and skips what waits on others", () => {
		expect(pick({ pinned: ["acme/web#6"], later: ["acme/web#4"] })).toEqual([
			[6, "ask"],
			[5, "update"],
			[3, "review"],
			[7, "re-review"],
			[2, "fix"],
		]);
		expect(
			pickTodayPullRequests(
				prioritizeMyPullRequests(pullRequests, { pinned: [], later: [] }),
				10,
			).some((item) => item.row.pr.prNumber === 1),
		).toBe(false);
	});
});
