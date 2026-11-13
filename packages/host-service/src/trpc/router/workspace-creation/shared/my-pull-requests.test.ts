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
		expect(query).toContain("closingIssuesReferences(first: 5)");
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
		lastCommit: {
			totalCount: 4,
			nodes: [{ commit: { committedDate: "2026-10-21T08:00:00Z" } }],
		},
		closingIssuesReferences: {
			nodes: [
				{
					number: 2944,
					title: "Group trends by local day",
					url: "https://github.com/acme/web/issues/2944",
					state: "OPEN",
				},
				null,
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
			baseRefName: null,
			behindBase: false,
			reviewDecision: "REVIEW_REQUIRED",
			mergeable: "CONFLICTING",
			checks: { status: "failure", failed: 2, pending: 2, total: 9 },
			viewerIsAuthor: false,
			reviewRequestedFromViewer: true,
			reviewRequestedAt: "2026-10-21T12:00:00Z",
			pendingReviewers: ["Me-User", "core"],
			reviews: [{ login: "bob", state: "CHANGES_REQUESTED" }],
			viewerReview: null,
			viewerLastReview: null,
			authorActiveSinceViewerReview: false,
			commitCount: 4,
			lastCommitAt: "2026-10-21T08:00:00Z",
			closingIssues: [
				{
					number: 2944,
					title: "Group trends by local day",
					url: "https://github.com/acme/web/issues/2944",
					state: "OPEN",
				},
			],
		});
	});

	test("accepts the unwrapped Octokit shape and PRs without checks", () => {
		const details = parseDetailsResponse({
			viewer: { login: "alice" },
			repository: {
				pr7: {
					...node,
					statusCheckRollup: null,
					timelineItems: null,
					lastCommit: null,
					closingIssuesReferences: null,
				},
				pr8: null,
			},
		});
		expect(details.size).toBe(1);
		expect(details.get(7)).toMatchObject({
			viewerIsAuthor: true,
			reviewRequestedFromViewer: false,
			reviewRequestedAt: null,
			viewerReview: null,
			checks: { status: "none", failed: 0, pending: 0, total: 0 },
			commitCount: null,
			lastCommitAt: null,
			closingIssues: [],
		});
	});

	describe("my last review", () => {
		const reviewed = {
			...node,
			baseRefName: "develop",
			headRefOid: "head2",
			mergeStateStatus: "BEHIND",
			reviews: {
				nodes: [
					{
						author: { login: "me-user" },
						state: "CHANGES_REQUESTED",
						submittedAt: "2026-10-21T10:00:00Z",
						commit: { oid: "head1" },
					},
				],
			},
			comments: { nodes: [] },
			lastCommit: {
				totalCount: 4,
				nodes: [{ commit: { committedDate: "2026-10-21T08:00:00Z" } }],
			},
		};
		const parse = (pr: Record<string, unknown>) =>
			parseDetailsResponse({
				viewer: { login: "me-user" },
				repository: { pr7: pr },
			}).get(7);

		test("flags a review on an old version and a branch behind its base", () => {
			expect(parse(reviewed)).toMatchObject({
				baseRefName: "develop",
				behindBase: true,
				viewerLastReview: {
					state: "CHANGES_REQUESTED",
					submittedAt: "2026-10-21T10:00:00Z",
					onHead: false,
				},
				authorActiveSinceViewerReview: false,
			});
		});

		test("sees the author push, reply or comment after it", () => {
			const pushed = {
				...reviewed,
				lastCommit: {
					totalCount: 5,
					nodes: [{ commit: { committedDate: "2026-10-22T08:00:00Z" } }],
				},
			};
			const replied = {
				...reviewed,
				reviews: {
					nodes: [
						...reviewed.reviews.nodes,
						{
							author: { login: "alice" },
							state: "COMMENTED",
							submittedAt: "2026-10-22T09:00:00Z",
							commit: { oid: "head1" },
						},
					],
				},
			};
			const commented = {
				...reviewed,
				comments: {
					nodes: [
						{ author: { login: "bob" }, createdAt: "2026-10-22T09:00:00Z" },
						{ author: { login: "Alice" }, createdAt: "2026-10-22T10:00:00Z" },
					],
				},
			};
			const someoneElse = {
				...reviewed,
				comments: {
					nodes: [
						{ author: { login: "bob" }, createdAt: "2026-10-22T09:00:00Z" },
					],
				},
			};
			expect(parse(pushed)?.authorActiveSinceViewerReview).toBe(true);
			expect(parse(replied)?.authorActiveSinceViewerReview).toBe(true);
			expect(parse(commented)?.authorActiveSinceViewerReview).toBe(true);
			expect(parse(someoneElse)?.authorActiveSinceViewerReview).toBe(false);
		});

		test("keeps no review of my own PR", () => {
			expect(
				parse({ ...reviewed, author: { login: "me-user" } })?.viewerLastReview,
			).toBeNull();
		});
	});
});
