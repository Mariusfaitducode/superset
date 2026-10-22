import {
	type PullRequestCheck,
	summarizePullRequestChecks,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/components/pull-request-checks";

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

export interface MyPullRequestInput {
	isDraft: boolean;
	checks: PullRequestCheck[];
	reviewDecision?: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
	mergeable?: "MERGEABLE" | "CONFLICTING" | "UNKNOWN" | null;
	viewerIsAuthor?: boolean | null;
	reviewRequestedFromViewer?: boolean | null;
}

export interface MyPullRequestStatus {
	waitingOnViewer: boolean;
	reasons: MyPullRequestReason[];
}

/** What an open PR is waiting for, from the viewer's side. */
export function describeMyPullRequest(
	pr: MyPullRequestInput,
): MyPullRequestStatus {
	const checks = summarizePullRequestChecks(pr.checks).status;
	const reasons: MyPullRequestReason[] = [];

	if (pr.viewerIsAuthor) {
		if (pr.mergeable === "CONFLICTING") reasons.push("conflicts");
		if (checks === "failure") reasons.push("ci-failing");
		if (pr.reviewDecision === "CHANGES_REQUESTED") {
			reasons.push("changes-requested");
		}
		if (pr.isDraft) reasons.push("draft");
		if (reasons.length === 0) {
			if (
				pr.reviewDecision === "APPROVED" &&
				(checks === "success" || checks === "none")
			) {
				reasons.push("ready-to-merge");
			} else {
				if (checks === "pending") reasons.push("ci-running");
				if (pr.reviewDecision !== "APPROVED") reasons.push("awaiting-review");
			}
		}
	} else if (pr.reviewRequestedFromViewer) {
		reasons.push("review-requested");
	} else {
		reasons.push("following");
	}

	return { waitingOnViewer: reasons.some(isReasonOnViewer), reasons };
}
