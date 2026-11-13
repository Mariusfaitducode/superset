import { describe, expect, it } from "bun:test";
import {
	describeMyPullRequest,
	type MyPullRequestDetails,
} from "./describeMyPullRequest";

const check = (status: "success" | "failure" | "pending") => ({
	status,
	failed: status === "failure" ? 1 : 0,
	pending: status === "pending" ? 1 : 0,
	total: 3,
});

const base: MyPullRequestDetails = {
	createdAt: null,
	additions: 1,
	deletions: 1,
	headRefName: "feature/x",
	reviewDecision: null,
	mergeable: "MERGEABLE",
	checks: check("success"),
	viewerIsAuthor: true,
	reviewRequestedFromViewer: false,
	reviewRequestedAt: null,
	pendingReviewers: [],
	reviews: [],
	viewerReview: null,
};

const pr = (
	details: Partial<MyPullRequestDetails> | null,
	isDraft = false,
) => ({
	isDraft,
	details: details === null ? null : { ...base, ...details },
});

describe("describeMyPullRequest", () => {
	it("puts every blocker of my own PR on me", () => {
		expect(
			describeMyPullRequest(
				pr({
					checks: check("failure"),
					mergeable: "CONFLICTING",
					reviewDecision: "CHANGES_REQUESTED",
				}),
			),
		).toEqual({
			waitingOnViewer: true,
			reasons: ["conflicts", "ci-failing", "changes-requested"],
		});
	});

	it("says ready to merge once approved and green", () => {
		expect(describeMyPullRequest(pr({ reviewDecision: "APPROVED" }))).toEqual({
			waitingOnViewer: true,
			reasons: ["ready-to-merge"],
		});
	});

	it("waits on others while CI runs or nobody approved", () => {
		expect(
			describeMyPullRequest(
				pr({
					checks: check("pending"),
					reviewDecision: "REVIEW_REQUIRED",
					pendingReviewers: ["bob"],
				}),
			),
		).toEqual({
			waitingOnViewer: false,
			reasons: ["ci-running", "awaiting-review"],
		});
		expect(describeMyPullRequest(pr({ pendingReviewers: ["bob"] }))).toEqual({
			waitingOnViewer: false,
			reasons: ["awaiting-review"],
		});
	});

	it("puts my PR on me when nobody was asked to review it", () => {
		expect(describeMyPullRequest(pr({}))).toEqual({
			waitingOnViewer: true,
			reasons: ["no-reviewer"],
		});
	});

	it("keeps a draft on me", () => {
		expect(describeMyPullRequest(pr({}, true))).toEqual({
			waitingOnViewer: true,
			reasons: ["draft"],
		});
	});

	it("puts someone else's PR on me only when my review is requested", () => {
		const theirs = { viewerIsAuthor: false, checks: check("failure") };
		expect(
			describeMyPullRequest(pr({ ...theirs, reviewRequestedFromViewer: true })),
		).toEqual({ waitingOnViewer: true, reasons: ["review-requested"] });
		expect(describeMyPullRequest(pr(theirs))).toEqual({
			waitingOnViewer: false,
			reasons: ["following"],
		});
	});

	it("does not ask for a review of a draft", () => {
		expect(
			describeMyPullRequest(
				pr({ viewerIsAuthor: false, reviewRequestedFromViewer: true }, true),
			),
		).toEqual({ waitingOnViewer: false, reasons: ["following"] });
	});

	it("does not claim authorship when details are missing", () => {
		expect(describeMyPullRequest(pr(null))).toEqual({
			waitingOnViewer: false,
			reasons: ["following"],
		});
	});

	it("puts someone else's PR back on me when its author moved since my review", () => {
		const reviewed = {
			viewerIsAuthor: false,
			viewerLastReview: {
				state: "COMMENTED" as const,
				submittedAt: "2026-11-03T14:41:12Z",
				onHead: false,
			},
		};
		expect(
			describeMyPullRequest(
				pr({ ...reviewed, authorActiveSinceViewerReview: true }),
			),
		).toEqual({ waitingOnViewer: true, reasons: ["re-review"] });
		expect(
			describeMyPullRequest(
				pr({ ...reviewed, authorActiveSinceViewerReview: false }),
			),
		).toEqual({ waitingOnViewer: false, reasons: ["following"] });
	});
});
