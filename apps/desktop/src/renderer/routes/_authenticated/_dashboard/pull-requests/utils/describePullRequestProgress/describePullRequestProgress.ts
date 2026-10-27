import { compareTodos } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/todo-order";
import type {
	MyPullRequestItem,
	MyPullRequestTicketLink,
} from "../describeMyPullRequest";

export interface PullRequestTicket {
	source: "github" | MyPullRequestTicketLink["source"];
	url: string;
	/** "#2944" for an issue; null for a page without a key. */
	ref: string | null;
	title: string | null;
	closed: boolean;
}

/** Closed issues first ("Closes #12"), then Notion/Linear/Jira links of the body. */
export function pullRequestTickets(
	pr: Pick<MyPullRequestItem, "details" | "ticketLinks">,
): PullRequestTicket[] {
	const issues = (pr.details?.closingIssues ?? []).map(
		(issue): PullRequestTicket => ({
			source: "github",
			url: issue.url,
			ref: `#${issue.number}`,
			title: issue.title,
			closed: issue.state === "CLOSED",
		}),
	);
	const links = (pr.ticketLinks ?? []).map(
		(link): PullRequestTicket => ({
			source: link.source,
			url: link.url,
			ref: null,
			title: link.title,
			closed: false,
		}),
	);
	return [...issues, ...links];
}

export type PullRequestReviewerState =
	| "approved"
	| "changes-requested"
	| "commented"
	| "requested";

export interface PullRequestReviewer {
	login: string;
	state: PullRequestReviewerState;
}

const REVIEWER_ORDER: Record<PullRequestReviewerState, number> = {
	"changes-requested": 0,
	requested: 1,
	approved: 2,
	commented: 3,
};

/**
 * One entry per reviewer. A pending request wins over an older review: the
 * reviewer was asked again and has not answered yet.
 */
export function pullRequestReviewers(
	details: MyPullRequestItem["details"],
): PullRequestReviewer[] {
	if (!details) return [];
	const byLogin = new Map<string, PullRequestReviewer>();
	for (const review of details.reviews) {
		if (review.state === "DISMISSED") continue;
		byLogin.set(review.login.toLowerCase(), {
			login: review.login,
			state:
				review.state === "APPROVED"
					? "approved"
					: review.state === "CHANGES_REQUESTED"
						? "changes-requested"
						: "commented",
		});
	}
	for (const login of details.pendingReviewers) {
		byLogin.set(login.toLowerCase(), { login, state: "requested" });
	}
	return [...byLogin.values()].sort(
		(a, b) =>
			REVIEWER_ORDER[a.state] - REVIEWER_ORDER[b.state] ||
			a.login.localeCompare(b.login),
	);
}

interface TodoLike {
	id: string;
	workspaceId: string;
	text: string;
	done: boolean;
	priority: "high" | "normal" | "low";
	dueOn: string | null;
	link: string | null;
	createdAt: number;
}

/** Open to-dos of the PR's workspace, plus any to-do that links to the PR. */
export function pullRequestTodos<T extends TodoLike>(
	todos: readonly T[],
	{ workspaceId, url }: { workspaceId: string | null; url: string },
): T[] {
	const prUrl = url.replace(/\/+$/, "").toLowerCase();
	return todos
		.filter(
			(todo) =>
				!todo.done &&
				((workspaceId !== null && todo.workspaceId === workspaceId) ||
					(todo.link !== null &&
						todo.link.replace(/\/+$/, "").toLowerCase() === prUrl)),
		)
		.sort(compareTodos);
}
