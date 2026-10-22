export type MyPullRequestReason =
	| "review-requested"
	| "conflicts"
	| "ci-failing"
	| "changes-requested"
	| "draft"
	| "ready-to-merge"
	| "ci-running"
	| "awaiting-review"
	| "following";

const REASONS_ON_VIEWER = new Set<MyPullRequestReason>([
	"review-requested",
	"conflicts",
	"ci-failing",
	"changes-requested",
	"draft",
	"ready-to-merge",
]);

export function isReasonOnViewer(reason: MyPullRequestReason): boolean {
	return REASONS_ON_VIEWER.has(reason);
}

export type MyPullRequestReviewState =
	| "APPROVED"
	| "CHANGES_REQUESTED"
	| "COMMENTED"
	| "DISMISSED";

export interface MyPullRequestDetails {
	createdAt: string | null;
	additions: number | null;
	deletions: number | null;
	headRefName: string | null;
	reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
	mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN" | null;
	checks: {
		status: "none" | "success" | "failure" | "pending";
		failed: number;
		pending: number;
		total: number;
	} | null;
	viewerIsAuthor: boolean | null;
	reviewRequestedFromViewer: boolean | null;
	reviewRequestedAt: string | null;
	pendingReviewers: string[];
	reviews: { login: string; state: MyPullRequestReviewState }[];
	viewerReview: MyPullRequestReviewState | null;
}

/** Mirrors a row of the host's listMyPullRequests. */
export interface MyPullRequestItem {
	projectId: string;
	repoFullName: string;
	prNumber: number;
	title: string;
	url: string;
	isDraft: boolean;
	authorLogin: string | null;
	updatedAt: string | null;
	/** null when GitHub did not return them for this PR. */
	details: MyPullRequestDetails | null;
}

export interface MyPullRequestStatus {
	waitingOnViewer: boolean;
	reasons: MyPullRequestReason[];
}

/** What an open PR is waiting for, from the viewer's side. */
export function describeMyPullRequest(
	pr: Pick<MyPullRequestItem, "isDraft" | "details">,
): MyPullRequestStatus {
	const details = pr.details;
	const checks = details?.checks?.status ?? "none";
	const reasons: MyPullRequestReason[] = [];

	if (details?.viewerIsAuthor) {
		if (details.mergeable === "CONFLICTING") reasons.push("conflicts");
		if (checks === "failure") reasons.push("ci-failing");
		if (details.reviewDecision === "CHANGES_REQUESTED") {
			reasons.push("changes-requested");
		}
		if (pr.isDraft) reasons.push("draft");
		if (reasons.length === 0) {
			if (
				details.reviewDecision === "APPROVED" &&
				(checks === "success" || checks === "none")
			) {
				reasons.push("ready-to-merge");
			} else {
				if (checks === "pending") reasons.push("ci-running");
				if (details.reviewDecision !== "APPROVED") {
					reasons.push("awaiting-review");
				}
			}
		}
	} else if (details?.reviewRequestedFromViewer && !pr.isDraft) {
		reasons.push("review-requested");
	} else {
		reasons.push("following");
	}

	return { waitingOnViewer: reasons.some(isReasonOnViewer), reasons };
}
