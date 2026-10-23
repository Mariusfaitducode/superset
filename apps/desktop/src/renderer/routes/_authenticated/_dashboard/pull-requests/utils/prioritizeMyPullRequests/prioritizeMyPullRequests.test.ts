import { describe, expect, it } from "bun:test";
import { makeMyPullRequest } from "../myPullRequestFixtures";
import { prioritizeMyPullRequests } from "./prioritizeMyPullRequests";

const theirs = { viewerIsAuthor: false, reviewRequestedFromViewer: true };

describe("prioritizeMyPullRequests", () => {
	const pullRequests = [
		makeMyPullRequest(1, { reviewDecision: "APPROVED" }),
		makeMyPullRequest(2, {
			checks: { status: "failure", failed: 2, pending: 0, total: 9 },
		}),
		makeMyPullRequest(
			3,
			{ ...theirs, reviewRequestedAt: "2026-10-21T00:00:00Z" },
			{ authorLogin: "alice" },
		),
		makeMyPullRequest(
			4,
			{ ...theirs, reviewRequestedAt: "2026-10-18T00:00:00Z" },
			{ authorLogin: "bob" },
		),
		makeMyPullRequest(5, { pendingReviewers: ["carol"] }),
		makeMyPullRequest(6, { viewerIsAuthor: false, viewerReview: "APPROVED" }),
		makeMyPullRequest(7, {
			reviewDecision: "CHANGES_REQUESTED",
			reviews: [{ login: "dave", state: "CHANGES_REQUESTED" }],
		}),
		makeMyPullRequest(8, {}, { isDraft: true }),
	];

	it("orders by next action: review, fix, merge, finish, wait, follow", () => {
		const groups = prioritizeMyPullRequests(pullRequests, {
			pinned: [],
			later: [],
		});
		expect(
			groups.map((group) => [
				group.action,
				group.rows.map((row) => row.pr.prNumber),
			]),
		).toEqual([
			["review", [4, 3]],
			["fix", [7, 2]],
			["merge", [1]],
			["finish", [8]],
			["wait", [5]],
			["follow", [6]],
		]);
	});

	it("says why each row is there", () => {
		const rows = prioritizeMyPullRequests(pullRequests, {
			pinned: [],
			later: [],
		}).flatMap((group) => group.rows);
		const why = (prNumber: number) =>
			rows.find((row) => row.pr.prNumber === prNumber)?.why;
		expect(why(4)).toEqual({
			kind: "review",
			author: "bob",
			since: "2026-10-18T00:00:00Z",
		});
		expect(why(7)).toEqual({ kind: "changes-requested", by: ["dave"] });
		expect(why(2)).toEqual({ kind: "ci-failing", failed: 2, total: 9 });
		expect(why(5)).toEqual({
			kind: "waiting-review",
			reviewers: ["carol"],
			since: "2026-10-01T00:00:00Z",
		});
		expect(why(6)).toEqual({ kind: "following", viewerReview: "APPROVED" });
	});

	it("lets pins win and moves later rows to the bottom", () => {
		const groups = prioritizeMyPullRequests(pullRequests, {
			pinned: ["acme/web#6", "acme/web#5"],
			later: ["acme/web#4"],
		});
		expect(groups[0]).toMatchObject({ action: "pinned" });
		expect(groups[0]?.rows.map((row) => row.pr.prNumber)).toEqual([6, 5]);
		expect(groups.at(-1)?.action).toBe("later");
		expect(groups.at(-1)?.rows.map((row) => row.pr.prNumber)).toEqual([4]);
	});
});
