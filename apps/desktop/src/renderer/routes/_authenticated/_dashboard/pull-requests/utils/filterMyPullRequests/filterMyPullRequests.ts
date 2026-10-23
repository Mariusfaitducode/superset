import type { MyPullRequestItem } from "../describeMyPullRequest";

export type MyPullRequestRole = "author" | "reviewer" | "involved";
export type MyPullRequestStateFilter =
	| "review-requested"
	| "ci-failing"
	| "conflicts"
	| "changes-requested"
	| "ready-to-merge"
	| "draft";
export type MyPullRequestAgeFilter = "any" | "day" | "week" | "month";

export const MY_PULL_REQUEST_ROLES: MyPullRequestRole[] = [
	"author",
	"reviewer",
	"involved",
];
export const MY_PULL_REQUEST_STATES: MyPullRequestStateFilter[] = [
	"review-requested",
	"ci-failing",
	"conflicts",
	"changes-requested",
	"ready-to-merge",
	"draft",
];
export const MY_PULL_REQUEST_AGES: MyPullRequestAgeFilter[] = [
	"any",
	"day",
	"week",
	"month",
];

export interface MyPullRequestFilters {
	repos: string[];
	roles: MyPullRequestRole[];
	states: MyPullRequestStateFilter[];
	age: MyPullRequestAgeFilter;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AGE_MS: Record<MyPullRequestAgeFilter, number> = {
	any: 0,
	day: DAY_MS,
	week: 7 * DAY_MS,
	month: 30 * DAY_MS,
};

export function roleOf(pr: MyPullRequestItem): MyPullRequestRole {
	if (pr.details?.viewerIsAuthor) return "author";
	if (pr.details?.reviewRequestedFromViewer || pr.details?.viewerReview) {
		return "reviewer";
	}
	return "involved";
}

export function matchesState(
	pr: MyPullRequestItem,
	state: MyPullRequestStateFilter,
): boolean {
	const details = pr.details;
	switch (state) {
		case "review-requested":
			return !!details?.reviewRequestedFromViewer;
		case "ci-failing":
			return details?.checks?.status === "failure";
		case "conflicts":
			return details?.mergeable === "CONFLICTING";
		case "changes-requested":
			return details?.reviewDecision === "CHANGES_REQUESTED";
		case "ready-to-merge":
			return (
				!pr.isDraft &&
				details?.reviewDecision === "APPROVED" &&
				details.mergeable !== "CONFLICTING" &&
				(details.checks?.status === "success" ||
					details.checks?.status === "none")
			);
		case "draft":
			return pr.isDraft;
	}
}

function matchesAge(
	pr: MyPullRequestItem,
	age: MyPullRequestAgeFilter,
	now: number,
): boolean {
	if (age === "any") return true;
	const created = Date.parse(pr.details?.createdAt ?? "");
	return !Number.isNaN(created) && now - created >= AGE_MS[age];
}

type Facet = "repos" | "roles" | "states" | "age";

function matches(
	pr: MyPullRequestItem,
	filters: MyPullRequestFilters,
	now: number,
	skip?: Facet,
): boolean {
	return (
		(skip === "repos" ||
			filters.repos.length === 0 ||
			filters.repos.includes(pr.repoFullName)) &&
		(skip === "roles" ||
			filters.roles.length === 0 ||
			filters.roles.includes(roleOf(pr))) &&
		(skip === "states" ||
			filters.states.length === 0 ||
			filters.states.some((state) => matchesState(pr, state))) &&
		(skip === "age" || matchesAge(pr, filters.age, now))
	);
}

export interface MyPullRequestFacetCounts {
	repos: Map<string, number>;
	roles: Record<MyPullRequestRole, number>;
	states: Record<MyPullRequestStateFilter, number>;
	age: Record<MyPullRequestAgeFilter, number>;
}

/**
 * Apply the filters and count every option. Each facet counts with the
 * other facets applied but not itself, so a count says what picking that
 * option would show.
 */
export function filterMyPullRequests(
	pullRequests: MyPullRequestItem[],
	filters: MyPullRequestFilters,
	now: number,
): { visible: MyPullRequestItem[]; counts: MyPullRequestFacetCounts } {
	const counts: MyPullRequestFacetCounts = {
		repos: new Map(),
		roles: { author: 0, reviewer: 0, involved: 0 },
		states: {
			"review-requested": 0,
			"ci-failing": 0,
			conflicts: 0,
			"changes-requested": 0,
			"ready-to-merge": 0,
			draft: 0,
		},
		age: { any: 0, day: 0, week: 0, month: 0 },
	};
	const visible: MyPullRequestItem[] = [];
	for (const pr of pullRequests) {
		if (matches(pr, filters, now)) visible.push(pr);
		if (matches(pr, filters, now, "repos")) {
			counts.repos.set(
				pr.repoFullName,
				(counts.repos.get(pr.repoFullName) ?? 0) + 1,
			);
		}
		if (matches(pr, filters, now, "roles")) counts.roles[roleOf(pr)] += 1;
		if (matches(pr, filters, now, "states")) {
			for (const state of MY_PULL_REQUEST_STATES) {
				if (matchesState(pr, state)) counts.states[state] += 1;
			}
		}
		if (matches(pr, filters, now, "age")) {
			for (const age of MY_PULL_REQUEST_AGES) {
				if (matchesAge(pr, age, now)) counts.age[age] += 1;
			}
		}
	}
	return { visible, counts };
}
