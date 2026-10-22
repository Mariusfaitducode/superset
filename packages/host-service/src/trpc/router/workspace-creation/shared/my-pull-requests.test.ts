import { describe, expect, test } from "bun:test";
import {
	buildDetailsQuery,
	chunk,
	parseDetailsResponse,
} from "./my-pull-requests";

describe("chunk", () => {
	test("splits into fixed-size batches", () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(chunk([], 10)).toEqual([]);
	});
});

describe("buildDetailsQuery", () => {
	test("aliases one pullRequest per number and asks only for check counts", () => {
		const query = buildDetailsQuery([12, 34]);
		expect(query).toContain("pr12: pullRequest(number: 12)");
		expect(query).toContain("pr34: pullRequest(number: 34)");
		expect(query).toContain("contexts(first: 0)");
		expect(query).not.toContain("detailsUrl");
	});
});

describe("parseDetailsResponse", () => {
	const node = {
		number: 7,
		createdAt: "2026-10-20T10:00:00Z",
		additions: 10,
		deletions: 2,
		headRefName: "feature/x",
		reviewDecision: "REVIEW_REQUIRED",
		mergeable: "CONFLICTING",
		author: { login: "alice" },
		reviewRequests: {
			nodes: [
				{ requestedReviewer: { login: "Me-User" } },
				{ requestedReviewer: { slug: "core" } },
				{ requestedReviewer: null },
			],
		},
		latestOpinionatedReviews: {
			nodes: [{ author: { login: "bob" }, state: "CHANGES_REQUESTED" }],
		},
		timelineItems: {
			nodes: [
				{
					createdAt: "2026-10-20T11:00:00Z",
					requestedReviewer: { login: "me-user" },
				},
				{
					createdAt: "2026-10-21T09:00:00Z",
					requestedReviewer: { login: "bob" },
				},
				{
					createdAt: "2026-10-21T12:00:00Z",
					requestedReviewer: { login: "me-user" },
				},
			],
		},
		statusCheckRollup: {
			state: "FAILURE",
			contexts: {
				checkRunCountsByState: [
					{ state: "SUCCESS", count: 5 },
					{ state: "FAILURE", count: 1 },
					{ state: "IN_PROGRESS", count: 2 },
				],
				statusContextCountsByState: [{ state: "ERROR", count: 1 }],
			},
		},
	};

	test("maps the gh envelope and resolves the viewer's side", () => {
		const details = parseDetailsResponse({
			data: { viewer: { login: "me-user" }, repository: { pr7: node } },
		});
		expect(details.get(7)).toEqual({
			createdAt: "2026-10-20T10:00:00Z",
			additions: 10,
			deletions: 2,
			headRefName: "feature/x",
			reviewDecision: "REVIEW_REQUIRED",
			mergeable: "CONFLICTING",
			checks: { status: "failure", failed: 2, pending: 2, total: 9 },
			viewerIsAuthor: false,
			reviewRequestedFromViewer: true,
			reviewRequestedAt: "2026-10-21T12:00:00Z",
			pendingReviewers: ["Me-User", "core"],
			reviews: [{ login: "bob", state: "CHANGES_REQUESTED" }],
		});
	});

	test("accepts the unwrapped Octokit shape and PRs without checks", () => {
		const details = parseDetailsResponse({
			viewer: { login: "alice" },
			repository: {
				pr7: { ...node, statusCheckRollup: null, timelineItems: null },
				pr8: null,
			},
		});
		expect(details.size).toBe(1);
		expect(details.get(7)).toMatchObject({
			viewerIsAuthor: true,
			reviewRequestedFromViewer: false,
			reviewRequestedAt: null,
			checks: { status: "none", failed: 0, pending: 0, total: 0 },
		});
	});
});
