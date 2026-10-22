import { describe, expect, it } from "bun:test";
import { makeMyPullRequest } from "../myPullRequestFixtures";
import {
	filterMyPullRequests,
	type MyPullRequestFilters,
} from "./filterMyPullRequests";

const now = Date.parse("2026-10-22T00:00:00Z");
const none: MyPullRequestFilters = {
	repos: [],
	roles: [],
	states: [],
	age: "any",
};

const pullRequests = [
	makeMyPullRequest(1, {
		checks: { status: "failure", failed: 1, pending: 0, total: 2 },
		createdAt: "2026-10-21T12:00:00Z",
	}),
	makeMyPullRequest(
		2,
		{ viewerIsAuthor: false, reviewRequestedFromViewer: true },
		{ repoFullName: "acme/api" },
	),
	makeMyPullRequest(3, { reviewDecision: "APPROVED" }),
	makeMyPullRequest(4, { viewerIsAuthor: false }, { isDraft: true }),
];

describe("filterMyPullRequests", () => {
	it("shows everything and counts each option without filters", () => {
		const { visible, counts } = filterMyPullRequests(pullRequests, none, now);
		expect(visible).toHaveLength(4);
		expect([...counts.repos]).toEqual([
			["acme/web", 3],
			["acme/api", 1],
		]);
		expect(counts.roles).toEqual({ author: 2, reviewer: 1, involved: 1 });
		expect(counts.states).toMatchObject({
			"ci-failing": 1,
			"review-requested": 1,
			"ready-to-merge": 1,
			draft: 1,
		});
		expect(counts.age).toEqual({ any: 4, day: 3, week: 3, month: 0 });
	});

	it("ORs options inside a facet and ANDs facets together", () => {
		const { visible, counts } = filterMyPullRequests(
			pullRequests,
			{ ...none, states: ["ci-failing", "ready-to-merge"], roles: ["author"] },
			now,
		);
		expect(visible.map((pr) => pr.prNumber)).toEqual([1, 3]);
		// A facet's own counts ignore its selection.
		expect(counts.states.draft).toBe(0);
		expect(counts.roles.reviewer).toBe(0);
		expect(counts.roles.author).toBe(2);
	});

	it("filters by repo and age", () => {
		expect(
			filterMyPullRequests(
				pullRequests,
				{ ...none, repos: ["acme/api"] },
				now,
			).visible.map((pr) => pr.prNumber),
		).toEqual([2]);
		expect(
			filterMyPullRequests(pullRequests, { ...none, age: "week" }, now).visible
				.length,
		).toBe(3);
	});
});
