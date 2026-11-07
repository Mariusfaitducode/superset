import type { AgentReport } from "renderer/hooks/host-service/useHostAgentReports";
import type { ConversationTodo } from "renderer/hooks/host-service/useHostConversationTodos";
import type { AgentConversation } from "renderer/hooks/useAgentConversations";
import {
	compareTodos,
	dueState,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/todo-order";
import {
	describeMyPullRequest,
	type MyPullRequestItem,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import { isTodoForUser } from "./todoAudience";

/** Report kinds on the Desk, most pressing first. Progress stays off it. */
export const REPORT_KINDS = ["decision", "draft", "blocked", "done"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/**
 * What an item asks of the user. `request` is a conversation stopped on a
 * question or a permission prompt, `failed` a turn that errored, `unseen` a
 * finished turn nobody has opened yet.
 */
export type DeskKind =
	| "request"
	| "failed"
	| "unseen"
	| ReportKind
	| "todo"
	| "pr";

export const DESK_SECTIONS = ["now", "next"] as const;
export type DeskSection = (typeof DESK_SECTIONS)[number];

// Within a section; ties go to what has waited longest. To-dos that can
// wait come last, so a long list of them never buries a hand-over.
const KIND_RANK: Record<DeskKind, number> = {
	request: 0,
	failed: 1,
	decision: 2,
	blocked: 3,
	draft: 4,
	todo: 5,
	unseen: 6,
	done: 7,
	pr: 8,
};

/** The conversation an item belongs to. */
export interface DeskOrigin {
	hostUrl: string;
	workspaceId: string;
	workspaceName: string;
	projectName: string | null;
	terminalId: string;
}

interface DeskItemBase {
	key: string;
	kind: DeskKind;
	section: DeskSection;
	/** Ms epoch: when it started waiting on the user. */
	waitingSince: number;
}

export type DeskItem = DeskItemBase &
	(
		| (DeskOrigin & { source: "report"; report: AgentReport })
		| (DeskOrigin & { source: "todo"; todo: ConversationTodo })
		| (DeskOrigin & {
				source: "conversation";
				conversation: AgentConversation;
		  })
		| {
				source: "pr";
				pr: MyPullRequestItem;
				hostUrl: string;
				projectName: string | null;
		  }
	);

/** Every item but a PR lives in a conversation. */
export type DeskConversationItem = Exclude<DeskItem, { source: "pr" }>;

export interface DeskWorkspace {
	name: string;
	projectName: string | null;
	hostUrl: string | null;
}

export interface DeskHostData {
	hostUrl: string;
	reports: AgentReport[] | null;
	todos: ConversationTodo[] | null;
	pullRequests: MyPullRequestItem[] | null;
}

export interface DeskSources {
	hosts: DeskHostData[];
	conversations: AgentConversation[];
	workspaces: ReadonlyMap<string, DeskWorkspace>;
	projectNames: ReadonlyMap<string, string>;
	/** Local calendar day, `YYYY-MM-DD`, for due to-dos. */
	today: string;
}

const CONVERSATION_KINDS: Partial<Record<string, DeskKind>> = {
	request: "request",
	failed: "failed",
	unseen: "unseen",
};

function todoSection(todo: ConversationTodo, today: string): DeskSection {
	const due = dueState(todo.dueOn, today);
	return todo.priority === "high" || due === "overdue" || due === "today"
		? "now"
		: "next";
}

const rank = (item: DeskItem) =>
	item.kind === "todo" && item.section === "next" ? 9 : KIND_RANK[item.kind];

function compareItems(a: DeskItem, b: DeskItem, today: string): number {
	const section =
		DESK_SECTIONS.indexOf(a.section) - DESK_SECTIONS.indexOf(b.section);
	if (section !== 0) return section;
	const kind = rank(a) - rank(b);
	if (kind !== 0) return kind;
	if (a.source === "todo" && b.source === "todo") {
		const overdue =
			Number(dueState(b.todo.dueOn, today) === "overdue") -
			Number(dueState(a.todo.dueOn, today) === "overdue");
		return overdue || compareTodos(a.todo, b.todo);
	}
	return a.waitingSince - b.waitingSince;
}

/**
 * Everything that waits on the user, across hosts, in one list: open
 * reports, conversations stopped on them, the to-dos meant for them and the
 * PRs whose review they were asked for. "Now" holds what blocks an agent or
 * is urgent, "Next" the rest. Items of a workspace the app no longer knows
 * are dropped, so an archived workspace leaves nothing behind.
 */
export function buildDeskQueue({
	hosts,
	conversations,
	workspaces,
	projectNames,
	today,
}: DeskSources): DeskItem[] {
	const items: DeskItem[] = [];
	const origin = (
		hostUrl: string,
		workspaceId: string,
		terminalId: string,
	): DeskOrigin | null => {
		const workspace = workspaces.get(workspaceId);
		if (!workspace) return null;
		return {
			hostUrl,
			workspaceId,
			workspaceName: workspace.name,
			projectName: workspace.projectName,
			terminalId,
		};
	};

	const reportedTerminals = new Set<string>();
	for (const { hostUrl, reports, todos, pullRequests } of hosts) {
		for (const report of reports ?? []) {
			if (report.status !== "open" || report.kind === "progress") continue;
			const where = origin(hostUrl, report.workspaceId, report.terminalId);
			if (!where) continue;
			reportedTerminals.add(report.terminalId);
			items.push({
				key: `report:${report.id}`,
				kind: report.kind,
				section: report.kind === "done" ? "next" : "now",
				source: "report",
				report,
				waitingSince: report.createdAt,
				...where,
			});
		}
		for (const todo of todos ?? []) {
			if (todo.done || !isTodoForUser(todo)) continue;
			const where = origin(hostUrl, todo.workspaceId, todo.terminalId);
			if (!where) continue;
			items.push({
				key: `todo:${todo.id}`,
				kind: "todo",
				section: todoSection(todo, today),
				source: "todo",
				todo,
				waitingSince: todo.createdAt,
				...where,
			});
		}
		for (const pr of pullRequests ?? []) {
			if (!describeMyPullRequest(pr).reasons.includes("review-requested")) {
				continue;
			}
			const requestedAt = Date.parse(
				pr.details?.reviewRequestedAt ?? pr.updatedAt ?? "",
			);
			items.push({
				key: `pr:${pr.repoFullName}#${pr.prNumber}`,
				kind: "pr",
				section: "next",
				source: "pr",
				pr,
				hostUrl,
				projectName: projectNames.get(pr.projectId) ?? null,
				waitingSince: Number.isNaN(requestedAt) ? 0 : requestedAt,
			});
		}
	}

	for (const conversation of conversations) {
		const kind = CONVERSATION_KINDS[conversation.state];
		if (!kind) continue;
		// The report already says what the finished turn wants.
		if (kind === "unseen" && reportedTerminals.has(conversation.terminalId)) {
			continue;
		}
		const hostUrl = workspaces.get(conversation.workspaceId)?.hostUrl;
		if (!hostUrl) continue;
		const where = origin(
			hostUrl,
			conversation.workspaceId,
			conversation.terminalId,
		);
		if (!where) continue;
		items.push({
			key: `conversation:${conversation.terminalId}`,
			kind,
			section: kind === "unseen" ? "next" : "now",
			source: "conversation",
			conversation,
			waitingSince: conversation.since,
			...where,
		});
	}

	return items.sort((a, b) => compareItems(a, b, today));
}
