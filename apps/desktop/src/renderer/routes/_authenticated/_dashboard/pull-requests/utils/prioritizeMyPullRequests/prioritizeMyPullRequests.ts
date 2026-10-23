import {
	describeMyPullRequest,
	type MyPullRequestItem,
	type MyPullRequestReviewState,
	type MyPullRequestStatus,
} from "../describeMyPullRequest";

/** The next action a PR asks for; the list is grouped and ordered by it. */
export type MyPullRequestAction =
	| "pinned"
	| "review"
	| "fix"
	| "merge"
	| "finish"
	| "wait"
	| "follow"
	| "later";

export const MY_PULL_REQUEST_ACTIONS: MyPullRequestAction[] = [
	"pinned",
	"review",
	"fix",
	"merge",
	"finish",
	"wait",
	"follow",
	"later",
];

/** Why a row sits where it does, rendered as one short line. */
export type MyPullRequestWhy =
	| { kind: "review"; author: string | null; since: string | null }
	| { kind: "changes-requested"; by: string[] }
	| { kind: "ci-failing"; failed: number; total: number }
	| { kind: "conflicts" }
	| { kind: "ready" }
	| { kind: "draft" }
	| { kind: "waiting-review"; reviewers: string[]; since: string | null }
	| { kind: "ci-running" }
	| { kind: "following"; viewerReview: MyPullRequestReviewState | null }
	| { kind: "unknown" };

export interface PrioritizedPullRequest {
	pr: MyPullRequestItem;
	key: string;
	status: MyPullRequestStatus;
	action: MyPullRequestAction;
	why: MyPullRequestWhy;
}

export interface MyPullRequestOverrides {
	/** Most recently pinned first. */
	pinned: string[];
	later: string[];
}

export function myPullRequestKey(
	pr: Pick<MyPullRequestItem, "repoFullName" | "prNumber">,
): string {
	return `${pr.repoFullName.toLowerCase()}#${pr.prNumber}`;
}

function naturalAction(status: MyPullRequestStatus): MyPullRequestAction {
	const reasons = new Set(status.reasons);
	if (reasons.has("review-requested")) return "review";
	if (
		reasons.has("changes-requested") ||
		reasons.has("ci-failing") ||
		reasons.has("conflicts")
	) {
		return "fix";
	}
	if (reasons.has("ready-to-merge")) return "merge";
	if (reasons.has("draft")) return "finish";
	if (reasons.has("ci-running") || reasons.has("awaiting-review")) {
		return "wait";
	}
	return "follow";
}

function describeWhy(
	pr: MyPullRequestItem,
	status: MyPullRequestStatus,
): MyPullRequestWhy {
	const details = pr.details;
	if (!details) return { kind: "unknown" };
	const reasons = new Set(status.reasons);
	if (reasons.has("review-requested")) {
		return {
			kind: "review",
			author: pr.authorLogin,
			since: details.reviewRequestedAt ?? details.createdAt,
		};
	}
	if (reasons.has("changes-requested")) {
		return {
			kind: "changes-requested",
			by: details.reviews
				.filter((review) => review.state === "CHANGES_REQUESTED")
				.map((review) => review.login),
		};
	}
	if (reasons.has("ci-failing")) {
		return {
			kind: "ci-failing",
			failed: details.checks?.failed ?? 0,
			total: details.checks?.total ?? 0,
		};
	}
	if (reasons.has("conflicts")) return { kind: "conflicts" };
	if (reasons.has("ready-to-merge")) return { kind: "ready" };
	if (reasons.has("draft")) return { kind: "draft" };
	if (reasons.has("awaiting-review")) {
		return {
			kind: "waiting-review",
			reviewers: details.pendingReviewers,
			since: details.createdAt,
		};
	}
	if (reasons.has("ci-running")) return { kind: "ci-running" };
	return { kind: "following", viewerReview: details.viewerReview };
}

const FIX_SEVERITY: Record<string, number> = {
	"changes-requested": 0,
	"ci-failing": 1,
	conflicts: 2,
};

function time(value: string | null | undefined): number {
	const parsed = value ? Date.parse(value) : Number.NaN;
	return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function updatedDesc(a: PrioritizedPullRequest, b: PrioritizedPullRequest) {
	return (b.pr.updatedAt ?? "").localeCompare(a.pr.updatedAt ?? "");
}

/**
 * Ordering inside each group. Waits run longest first: the oldest review
 * request is the person blocked the longest; the oldest PR waiting on
 * reviewers is the one to nudge.
 */
function compareWithin(
	action: MyPullRequestAction,
	overrides: MyPullRequestOverrides,
): (a: PrioritizedPullRequest, b: PrioritizedPullRequest) => number {
	switch (action) {
		case "pinned":
			return (a, b) =>
				overrides.pinned.indexOf(a.key) - overrides.pinned.indexOf(b.key);
		case "review":
			return (a, b) =>
				time(a.why.kind === "review" ? a.why.since : null) -
					time(b.why.kind === "review" ? b.why.since : null) ||
				updatedDesc(a, b);
		case "fix":
			return (a, b) =>
				(FIX_SEVERITY[a.why.kind] ?? 3) - (FIX_SEVERITY[b.why.kind] ?? 3) ||
				updatedDesc(a, b);
		case "merge":
		case "wait":
			return (a, b) =>
				time(a.pr.details?.createdAt) - time(b.pr.details?.createdAt) ||
				updatedDesc(a, b);
		default:
			return updatedDesc;
	}
}

export interface MyPullRequestGroup {
	action: MyPullRequestAction;
	rows: PrioritizedPullRequest[];
}

export function prioritizeMyPullRequests(
	pullRequests: MyPullRequestItem[],
	overrides: MyPullRequestOverrides,
): MyPullRequestGroup[] {
	const pinned = new Set(overrides.pinned);
	const later = new Set(overrides.later);
	const byAction = new Map<MyPullRequestAction, PrioritizedPullRequest[]>();
	for (const pr of pullRequests) {
		const key = myPullRequestKey(pr);
		const status = describeMyPullRequest(pr);
		const action = pinned.has(key)
			? "pinned"
			: later.has(key)
				? "later"
				: naturalAction(status);
		const rows = byAction.get(action) ?? [];
		rows.push({ pr, key, status, action, why: describeWhy(pr, status) });
		byAction.set(action, rows);
	}
	return MY_PULL_REQUEST_ACTIONS.flatMap((action) => {
		const rows = byAction.get(action);
		if (!rows) return [];
		return [{ action, rows: rows.sort(compareWithin(action, overrides)) }];
	});
}
