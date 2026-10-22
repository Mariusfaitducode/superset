import { z } from "zod";

export type MyPullRequestChecksStatus =
	| "none"
	| "success"
	| "failure"
	| "pending";

export interface MyPullRequestChecks {
	status: MyPullRequestChecksStatus;
	failed: number;
	pending: number;
	total: number;
}

export interface MyPullRequestReview {
	login: string;
	state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
}

/** What the Mine view needs per PR: no check list, only its counts. */
export interface MyPullRequestDetails {
	createdAt: string | null;
	additions: number | null;
	deletions: number | null;
	headRefName: string | null;
	reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
	mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN" | null;
	checks: MyPullRequestChecks | null;
	viewerIsAuthor: boolean | null;
	reviewRequestedFromViewer: boolean | null;
	/** When my review was last requested, to rank long waits first. */
	reviewRequestedAt: string | null;
	/** Users and teams whose review is still requested. */
	pendingReviewers: string[];
	reviews: MyPullRequestReview[];
}

// One query per repo costs ~6.5 s for 40 PRs and gets close to the gh
// timeout; batches of 10 run in parallel in ~2 s.
export const DETAILS_BATCH_SIZE = 10;

export function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

const PULL_REQUEST_SELECTION = `
	number
	createdAt
	additions
	deletions
	headRefName
	reviewDecision
	mergeable
	author { login }
	reviewRequests(first: 20) {
		nodes { requestedReviewer { ... on User { login } ... on Team { slug } } }
	}
	latestOpinionatedReviews(first: 20) {
		nodes { author { login } state }
	}
	timelineItems(last: 10, itemTypes: [REVIEW_REQUESTED_EVENT]) {
		nodes { ... on ReviewRequestedEvent { createdAt requestedReviewer { ... on User { login } } } }
	}
	statusCheckRollup {
		state
		contexts(first: 0) {
			checkRunCountsByState { state count }
			statusContextCountsByState { state count }
		}
	}`;

export function buildDetailsQuery(numbers: number[]): string {
	const selections = numbers
		.map(
			(number) =>
				`pr${number}: pullRequest(number: ${number}) {${PULL_REQUEST_SELECTION}\n}`,
		)
		.join("\n");
	return `query($owner: String!, $name: String!) {
	viewer { login }
	repository(owner: $owner, name: $name) {
${selections}
	}
}`;
}

const countSchema = z.object({ state: z.string(), count: z.number() });

const detailsNodeSchema = z.object({
	number: z.number(),
	createdAt: z.string().nullable().optional(),
	additions: z.number().nullable().optional(),
	deletions: z.number().nullable().optional(),
	headRefName: z.string().nullable().optional(),
	reviewDecision: z.string().nullable().optional(),
	mergeable: z.string().nullable().optional(),
	author: z.object({ login: z.string() }).nullable().optional(),
	reviewRequests: z
		.object({
			nodes: z.array(
				z
					.object({
						requestedReviewer: z
							.object({
								login: z.string().optional(),
								slug: z.string().optional(),
							})
							.nullable()
							.optional(),
					})
					.nullable(),
			),
		})
		.nullable()
		.optional(),
	latestOpinionatedReviews: z
		.object({
			nodes: z.array(
				z
					.object({
						author: z.object({ login: z.string() }).nullable().optional(),
						state: z.string(),
					})
					.nullable(),
			),
		})
		.nullable()
		.optional(),
	timelineItems: z
		.object({
			nodes: z.array(
				z
					.object({
						createdAt: z.string().optional(),
						requestedReviewer: z
							.object({ login: z.string().optional() })
							.nullable()
							.optional(),
					})
					.nullable(),
			),
		})
		.nullable()
		.optional(),
	statusCheckRollup: z
		.object({
			state: z.string().nullable().optional(),
			contexts: z
				.object({
					checkRunCountsByState: z.array(countSchema).nullable().optional(),
					statusContextCountsByState: z
						.array(countSchema)
						.nullable()
						.optional(),
				})
				.nullable()
				.optional(),
		})
		.nullable()
		.optional(),
});

const detailsDataSchema = z.object({
	viewer: z.object({ login: z.string() }).nullable().optional(),
	repository: z.record(z.string(), detailsNodeSchema.nullable()).nullable(),
});

const FAILED_STATES = new Set([
	"FAILURE",
	"ERROR",
	"TIMED_OUT",
	"STARTUP_FAILURE",
	"ACTION_REQUIRED",
	"CANCELLED",
]);
const PENDING_STATES = new Set([
	"PENDING",
	"EXPECTED",
	"QUEUED",
	"IN_PROGRESS",
	"WAITING",
]);

function toChecks(
	rollup: z.infer<typeof detailsNodeSchema>["statusCheckRollup"],
): MyPullRequestChecks {
	if (!rollup) return { status: "none", failed: 0, pending: 0, total: 0 };
	const counts = [
		...(rollup.contexts?.checkRunCountsByState ?? []),
		...(rollup.contexts?.statusContextCountsByState ?? []),
	];
	let failed = 0;
	let pending = 0;
	let total = 0;
	for (const { state, count } of counts) {
		total += count;
		if (FAILED_STATES.has(state)) failed += count;
		else if (PENDING_STATES.has(state)) pending += count;
	}
	const status: MyPullRequestChecksStatus =
		rollup.state === "SUCCESS"
			? "success"
			: rollup.state === "FAILURE" || rollup.state === "ERROR"
				? "failure"
				: rollup.state === "PENDING" || rollup.state === "EXPECTED"
					? "pending"
					: "none";
	return { status, failed, pending, total };
}

const REVIEW_DECISIONS = new Set([
	"APPROVED",
	"CHANGES_REQUESTED",
	"REVIEW_REQUIRED",
]);
const MERGEABLE_STATES = new Set(["MERGEABLE", "CONFLICTING", "UNKNOWN"]);
const REVIEW_STATES = new Set([
	"APPROVED",
	"CHANGES_REQUESTED",
	"COMMENTED",
	"DISMISSED",
]);

/**
 * Map a details batch, keyed by PR number. `gh api graphql` returns the
 * `{ data }` envelope; octokit.graphql resolves to the inner object.
 */
export function parseDetailsResponse(
	raw: unknown,
): Map<number, MyPullRequestDetails> {
	const data =
		typeof raw === "object" && raw !== null && "data" in raw
			? (raw as { data: unknown }).data
			: raw;
	const parsed = detailsDataSchema.parse(data);
	const viewerLogin = parsed.viewer?.login.toLowerCase() ?? null;
	const details = new Map<number, MyPullRequestDetails>();
	for (const node of Object.values(parsed.repository ?? {})) {
		if (!node) continue;
		const pendingReviewers = (node.reviewRequests?.nodes ?? []).flatMap(
			(request) => {
				const reviewer = request?.requestedReviewer;
				const name = reviewer?.login ?? reviewer?.slug;
				return name ? [name] : [];
			},
		);
		const viewerRequests = (node.timelineItems?.nodes ?? []).filter(
			(event) =>
				!!viewerLogin &&
				event?.requestedReviewer?.login?.toLowerCase() === viewerLogin,
		);
		details.set(node.number, {
			createdAt: node.createdAt ?? null,
			additions: node.additions ?? null,
			deletions: node.deletions ?? null,
			headRefName: node.headRefName ?? null,
			reviewDecision: REVIEW_DECISIONS.has(node.reviewDecision ?? "")
				? (node.reviewDecision as MyPullRequestDetails["reviewDecision"])
				: null,
			mergeable: MERGEABLE_STATES.has(node.mergeable ?? "")
				? (node.mergeable as MyPullRequestDetails["mergeable"])
				: null,
			checks: toChecks(node.statusCheckRollup),
			viewerIsAuthor:
				viewerLogin && node.author
					? node.author.login.toLowerCase() === viewerLogin
					: null,
			reviewRequestedFromViewer: viewerLogin
				? pendingReviewers.some((name) => name.toLowerCase() === viewerLogin)
				: null,
			reviewRequestedAt: viewerRequests.at(-1)?.createdAt ?? null,
			pendingReviewers,
			reviews: (node.latestOpinionatedReviews?.nodes ?? []).flatMap((review) =>
				review?.author && REVIEW_STATES.has(review.state)
					? [
							{
								login: review.author.login,
								state: review.state as MyPullRequestReview["state"],
							},
						]
					: [],
			),
		});
	}
	return details;
}
