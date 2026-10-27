import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import {
	LuCheck,
	LuCircleDot,
	LuEye,
	LuFileText,
	LuGitCommitHorizontal,
	LuListTodo,
	LuMessageSquare,
	LuMessageSquareWarning,
	LuTicket,
} from "react-icons/lu";
import type { ConversationTodo } from "renderer/hooks/host-service/useHostConversationTodos";
import type { AgentConversation } from "renderer/hooks/useAgentConversations";
import { formatRelativeTime } from "renderer/lib/formatRelativeTime";
import { DOT_CLASS } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/DashboardSidebarConversationList";
import {
	PR_GREEN_TEXT_CLASS_NAME,
	PR_RED_TEXT_CLASS_NAME,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/components/pull-request-colors";
import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import {
	type PullRequestReviewerState,
	type PullRequestTicket,
	pullRequestReviewers,
	pullRequestTickets,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describePullRequestProgress";
import {
	agentStateLabels,
	reviewerStateLabels,
} from "../../utils/myPullRequestLabels";

const MAX_TICKETS = 2;
const MAX_REVIEWERS = 4;

const REVIEWER_ICON: Record<PullRequestReviewerState, ReactNode> = {
	approved: <LuCheck className={cn("size-3", PR_GREEN_TEXT_CLASS_NAME)} />,
	"changes-requested": (
		<LuMessageSquareWarning className={cn("size-3", PR_RED_TEXT_CLASS_NAME)} />
	),
	requested: <LuEye className="size-3 text-amber-500" />,
	commented: <LuMessageSquare className="size-3" />,
};

function TicketIcon({ ticket }: { ticket: PullRequestTicket }) {
	if (ticket.source === "github") {
		return (
			<LuCircleDot
				className={cn(
					"size-3 shrink-0",
					ticket.closed ? "text-violet-500" : PR_GREEN_TEXT_CLASS_NAME,
				)}
			/>
		);
	}
	if (ticket.source === "notion") {
		return <LuFileText className="size-3 shrink-0" />;
	}
	return <LuTicket className="size-3 shrink-0" />;
}

/** A segment that opens something without opening the PR row. */
function Action({
	title,
	className,
	onClick,
	children,
}: {
	title: string;
	className?: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			title={title}
			className={cn(
				"flex min-w-0 items-center gap-1 rounded px-0.5 hover:bg-accent hover:text-foreground",
				className,
			)}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
		>
			{children}
		</button>
	);
}

interface MyPullRequestStatusLineProps {
	pr: MyPullRequestItem;
	conversation: AgentConversation | null;
	todos: ConversationTodo[];
	onOpenUrl: (url: string) => void;
	onOpenConversation: (conversation: AgentConversation) => void;
}

/** The second line of a row: ticket, reviewers, agent, to-dos and commits. */
export function MyPullRequestStatusLine({
	pr,
	conversation,
	todos,
	onOpenUrl,
	onOpenConversation,
}: MyPullRequestStatusLineProps) {
	const { t } = useLingui();
	const tickets = pullRequestTickets(pr);
	const reviewers = pullRequestReviewers(pr.details);
	const reviewerLabel = reviewerStateLabels();
	const agentLabel = agentStateLabels();
	const commitCount = pr.details?.commitCount ?? null;
	const lastCommitAt = pr.details?.lastCommitAt
		? Date.parse(pr.details.lastCommitAt)
		: Number.NaN;
	const lastCommitAgo = Number.isNaN(lastCommitAt)
		? null
		: formatRelativeTime(lastCommitAt);
	const firstTodo = todos[0];

	return (
		<div className="flex h-5 min-w-0 items-center gap-3 overflow-hidden pl-[2.875rem] text-[11px] text-muted-foreground">
			{tickets.length === 0 ? (
				<span className="shrink-0 text-muted-foreground/50">{t`No ticket`}</span>
			) : (
				<span className="flex min-w-0 shrink items-center gap-2">
					{tickets.slice(0, MAX_TICKETS).map((ticket) => {
						const name = [ticket.ref, ticket.title].filter(Boolean).join(" ");
						return (
							<Action
								key={ticket.url}
								title={
									ticket.closed
										? t`Ticket (closed): ${name || ticket.url}`
										: t`Ticket: ${name || ticket.url}`
								}
								className="max-w-64"
								onClick={() => onOpenUrl(ticket.url)}
							>
								<TicketIcon ticket={ticket} />
								{ticket.ref && (
									<span className="shrink-0 tabular-nums">{ticket.ref}</span>
								)}
								<span className="truncate">
									{ticket.title ??
										(ticket.source === "notion" ? t`Notion page` : ticket.url)}
								</span>
							</Action>
						);
					})}
					{tickets.length > MAX_TICKETS && (
						<span className="shrink-0">+{tickets.length - MAX_TICKETS}</span>
					)}
				</span>
			)}

			{reviewers.length > 0 && (
				<span className="flex shrink-0 items-center gap-2">
					{reviewers.slice(0, MAX_REVIEWERS).map((reviewer) => (
						<span
							key={reviewer.login}
							className="flex items-center gap-0.5"
							title={`@${reviewer.login} ${reviewerLabel[reviewer.state]}`}
						>
							{REVIEWER_ICON[reviewer.state]}
							<span className="max-w-24 truncate">{reviewer.login}</span>
						</span>
					))}
					{reviewers.length > MAX_REVIEWERS && (
						<span>+{reviewers.length - MAX_REVIEWERS}</span>
					)}
				</span>
			)}

			{conversation && (
				<Action
					title={t`Open conversation: ${conversation.title}`}
					className="max-w-56 shrink"
					onClick={() => onOpenConversation(conversation)}
				>
					<span
						className={cn(
							"size-1.5 shrink-0 rounded-full",
							DOT_CLASS[conversation.state],
						)}
					/>
					<span className="shrink-0">{agentLabel[conversation.state]}</span>
				</Action>
			)}

			{firstTodo && (
				<span
					className="flex min-w-0 shrink items-center gap-1"
					title={todos.map((todo) => `• ${todo.text}`).join("\n")}
				>
					<LuListTodo className="size-3 shrink-0" />
					<span className="shrink-0 tabular-nums">
						{todos.length === 1 ? t`1 to-do:` : t`${todos.length} to-dos:`}
					</span>
					<span className="max-w-56 truncate text-foreground/80">
						{firstTodo.text}
					</span>
				</span>
			)}

			{commitCount !== null && (
				<span
					className="ml-auto flex shrink-0 items-center gap-1 tabular-nums"
					title={
						lastCommitAgo ? t`Last commit ${lastCommitAgo} ago` : undefined
					}
				>
					<LuGitCommitHorizontal className="size-3" />
					{commitCount === 1 ? t`1 commit` : t`${commitCount} commits`}
					{lastCommitAgo && (
						<span className="text-muted-foreground/70">· {lastCommitAgo}</span>
					)}
				</span>
			)}
		</div>
	);
}
