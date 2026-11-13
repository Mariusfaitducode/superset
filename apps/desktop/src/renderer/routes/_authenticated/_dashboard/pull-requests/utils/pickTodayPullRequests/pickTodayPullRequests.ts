import {
	type MyPullRequestGroup,
	naturalAction,
	type PrioritizedPullRequest,
} from "../prioritizeMyPullRequests";

/** What to do with a PR today, the verb its card leads with. */
export type TodayVerb =
	| "merge"
	| "update"
	| "review"
	| "re-review"
	| "fix"
	| "ask";

export interface TodayItem {
	row: PrioritizedPullRequest;
	verb: TodayVerb;
}

export const TODAY_LIMIT = 5;

// Merging is the cheapest win, then the people blocked on me, then my own
// blocked PRs, then the PRs nobody looks at yet.
const VERB_RANK: Record<TodayVerb, number> = {
	merge: 0,
	update: 1,
	review: 2,
	"re-review": 3,
	fix: 4,
	ask: 5,
};

function verbOf(row: PrioritizedPullRequest): TodayVerb | null {
	switch (naturalAction(row.status)) {
		case "merge":
			return row.why.kind === "ready" && row.why.behind !== null
				? "update"
				: "merge";
		case "review":
			return row.why.kind === "re-review" ? "re-review" : "review";
		case "fix":
			return "fix";
		case "ask":
			return "ask";
		default:
			return null;
	}
}

/**
 * The few PRs worth doing first today, from the prioritized list. Pinned
 * rows come first; "later" rows never show. The list order breaks ties.
 */
export function pickTodayPullRequests(
	groups: MyPullRequestGroup[],
	limit = TODAY_LIMIT,
): TodayItem[] {
	const items: (TodayItem & { pinned: boolean; index: number })[] = [];
	let index = 0;
	for (const group of groups) {
		if (group.action === "later") continue;
		for (const row of group.rows) {
			const verb = verbOf(row);
			if (verb) {
				items.push({ row, verb, pinned: group.action === "pinned", index });
			}
			index += 1;
		}
	}
	return items
		.sort(
			(a, b) =>
				Number(b.pinned) - Number(a.pinned) ||
				VERB_RANK[a.verb] - VERB_RANK[b.verb] ||
				a.index - b.index,
		)
		.slice(0, limit)
		.map(({ row, verb }) => ({ row, verb }));
}
