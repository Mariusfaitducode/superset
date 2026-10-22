import type {
	MyPullRequestDetails,
	MyPullRequestItem,
} from "../describeMyPullRequest";

const details: MyPullRequestDetails = {
	createdAt: "2026-10-01T00:00:00Z",
	additions: 10,
	deletions: 2,
	headRefName: "feature/x",
	reviewDecision: null,
	mergeable: "MERGEABLE",
	checks: { status: "success", failed: 0, pending: 0, total: 3 },
	viewerIsAuthor: true,
	reviewRequestedFromViewer: false,
	reviewRequestedAt: null,
	pendingReviewers: [],
	reviews: [],
	viewerReview: null,
};

export function makeMyPullRequest(
	prNumber: number,
	overrides: Partial<MyPullRequestDetails> = {},
	item: Partial<Omit<MyPullRequestItem, "details">> = {},
): MyPullRequestItem {
	return {
		projectId: "project",
		repoFullName: "acme/web",
		prNumber,
		title: `PR ${prNumber}`,
		url: `https://github.com/acme/web/pull/${prNumber}`,
		isDraft: false,
		authorLogin: "me",
		updatedAt: "2026-10-20T00:00:00Z",
		details: { ...details, ...overrides },
		...item,
	};
}
