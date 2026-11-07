import { useLingui } from "@lingui/react/macro";
import { Avatar, AvatarFallback, AvatarImage } from "@superset/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import {
	LuArrowDown,
	LuArrowUp,
	LuBot,
	LuCheck,
	LuCircleCheck,
	LuCircleDashed,
	LuCircleX,
	LuEllipsis,
	LuExternalLink,
	LuEye,
	LuFolderInput,
	LuGitBranch,
	LuGitMerge,
	LuMessageSquareWarning,
	LuPin,
	LuPinOff,
} from "react-icons/lu";
import type { AgentConversation } from "renderer/hooks/useAgentConversations";
import { formatRelativeTime } from "renderer/lib/formatRelativeTime";
import { DOT_CLASS } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/DashboardSidebarConversationList";
import {
	PR_GREEN_TEXT_CLASS_NAME,
	PR_RED_TEXT_CLASS_NAME,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/components/pull-request-colors";
import type {
	MyPullRequestWhy,
	PrioritizedPullRequest,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/prioritizeMyPullRequests";
import {
	OTHER_PROJECT_ID,
	type PullRequestProject,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";
import type { HostWorkspaceItem } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import {
	normalizePRState,
	PRIcon,
} from "renderer/screens/main/components/PRIcon";
import { getV2WorkspaceDisplayName } from "renderer/utils/getV2WorkspaceDisplayName";
import { whyLabel } from "../../utils/myPullRequestLabels";

const AMBER_TEXT_CLASS_NAME = "text-amber-700 [.dark_&]:text-amber-300";

const WHY_TONE: Record<MyPullRequestWhy["kind"], string> = {
	review: AMBER_TEXT_CLASS_NAME,
	"changes-requested": PR_RED_TEXT_CLASS_NAME,
	"ci-failing": PR_RED_TEXT_CLASS_NAME,
	conflicts: PR_RED_TEXT_CLASS_NAME,
	ready: PR_GREEN_TEXT_CLASS_NAME,
	draft: "text-foreground",
	"waiting-review": "text-muted-foreground",
	"ci-running": "text-muted-foreground",
	following: "text-muted-foreground",
	unknown: "text-muted-foreground",
};

/** Column widths shared with the list's header row. */
export const MY_PULL_REQUEST_COLUMNS = {
	why: "w-32 @2xl:w-52",
	ci: "w-9",
	review: "w-5",
	conflicts: "w-5",
	size: "hidden w-10 @3xl:block",
	age: "hidden w-8 @3xl:block",
	activity: "hidden w-8 @2xl:block",
	who: "hidden w-5 @2xl:block",
	link: "w-6",
	menu: "w-6",
} as const;

const NUMBER_CELL = "shrink-0 text-right text-[11px] tabular-nums";

function relative(value: string | null | undefined): string | null {
	const parsed = value ? Date.parse(value) : Number.NaN;
	return Number.isNaN(parsed) ? null : formatRelativeTime(parsed);
}

function compactCount(value: number): string {
	return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

/** The other side of the wait: who waits on me, or whom I wait on. */
function counterpart({ why, pr }: PrioritizedPullRequest): string | null {
	switch (why.kind) {
		case "changes-requested":
			return why.by[0] ?? null;
		case "waiting-review":
			return why.reviewers[0] ?? null;
		case "review":
		case "following":
		case "unknown":
			return pr.authorLogin;
		default:
			return null;
	}
}

interface MyPullRequestRowProps {
	row: PrioritizedPullRequest;
	isSelected: boolean;
	isPinned: boolean;
	isLater: boolean;
	workspace: HostWorkspaceItem | undefined;
	conversation: AgentConversation | null;
	onOpen: () => void;
	onTogglePinned: () => void;
	onToggleLater: () => void;
	onOpenOnGitHub: () => void;
	onOpenWorkspace: (workspaceId: string) => void;
	onOpenConversation: (conversation: AgentConversation) => void;
	/** A second line under the row, shown when grouped by project. */
	statusLine?: ReactNode;
	projects: Pick<PullRequestProject, "id" | "name">[];
	/** Where the PR is now: a project id or OTHER_PROJECT_ID. */
	projectId: string;
	isMovedByHand: boolean;
	/** null hands the PR back to the rules. */
	onMoveToProject: (projectId: string | null) => void;
}

/** One dense line (two with `statusLine`): the reason it is here, then CI, review, conflicts, size, age, activity and who. */
export function MyPullRequestRow({
	row,
	isSelected,
	isPinned,
	isLater,
	workspace,
	conversation,
	onOpen,
	onTogglePinned,
	onToggleLater,
	onOpenOnGitHub,
	onOpenWorkspace,
	onOpenConversation,
	statusLine,
	projects,
	projectId,
	isMovedByHand,
	onMoveToProject,
}: MyPullRequestRowProps) {
	const { t } = useLingui();
	const { pr, why } = row;
	const details = pr.details;
	const checks = details?.checks;
	const reason = whyLabel(why);
	const createdAgo = relative(details?.createdAt);
	const updatedAgo = relative(pr.updatedAt);
	const person = counterpart(row);
	const additions = details?.additions ?? null;
	const deletions = details?.deletions ?? null;
	const hasSize = additions != null || deletions != null;
	const repoName = pr.repoFullName.split("/")[1] ?? pr.repoFullName;
	const pinLabel = isPinned ? t`Unpin` : t`Pin to the top`;

	const ciTitle =
		checks?.status === "failure"
			? t`CI failing: ${checks.failed} of ${checks.total} checks`
			: checks?.status === "pending"
				? t`CI running: ${checks.pending} of ${checks.total} checks`
				: checks?.status === "success"
					? t`CI green`
					: t`No CI`;
	const reviewTitle =
		details?.reviewDecision === "APPROVED"
			? t`Approved`
			: details?.reviewDecision === "CHANGES_REQUESTED"
				? t`Changes requested`
				: details?.reviewDecision === "REVIEW_REQUIRED"
					? t`Review required`
					: undefined;

	return (
		// biome-ignore lint/a11y/useSemanticElements: row is a composite list item, not a native control
		<div
			className={cn(
				"group flex cursor-pointer flex-col rounded-md px-2 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
				isSelected && "bg-accent",
				isLater && "opacity-60",
			)}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onOpen();
				}
			}}
			role="button"
			tabIndex={0}
			aria-current={isSelected ? "true" : undefined}
		>
			<div className="flex h-8 items-center gap-2">
				<button
					type="button"
					title={pinLabel}
					aria-label={pinLabel}
					className={cn(
						"flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground",
						!isPinned &&
							"opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
					)}
					onClick={(event) => {
						event.stopPropagation();
						onTogglePinned();
					}}
				>
					<LuPin className={cn("size-3", isPinned && "fill-current")} />
				</button>
				<PRIcon
					state={normalizePRState("open", pr.isDraft)}
					className="size-3.5 shrink-0"
				/>
				<div
					className="flex min-w-0 flex-1 items-baseline gap-2"
					title={pr.title}
				>
					<span className="truncate text-[13px] font-medium text-foreground">
						{pr.title}
					</span>
					<span className="hidden shrink-0 text-[10px] text-muted-foreground/70 tabular-nums @xl:inline">
						{repoName}#{pr.prNumber}
					</span>
				</div>

				<span
					className={cn(
						"shrink-0 truncate text-[11px]",
						MY_PULL_REQUEST_COLUMNS.why,
						WHY_TONE[why.kind],
					)}
					title={reason}
				>
					{reason}
				</span>
				<span
					className={cn(
						"flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums",
						MY_PULL_REQUEST_COLUMNS.ci,
					)}
					title={ciTitle}
				>
					{checks?.status === "failure" ? (
						<>
							<LuCircleX className={cn("size-3.5", PR_RED_TEXT_CLASS_NAME)} />
							<span className={PR_RED_TEXT_CLASS_NAME}>{checks.failed}</span>
						</>
					) : checks?.status === "pending" ? (
						<LuCircleDashed className="size-3.5 text-amber-500" />
					) : checks?.status === "success" ? (
						<LuCircleCheck
							className={cn("size-3.5", PR_GREEN_TEXT_CLASS_NAME)}
						/>
					) : (
						<span className="text-muted-foreground/50">–</span>
					)}
				</span>
				<span
					className={cn("flex shrink-0", MY_PULL_REQUEST_COLUMNS.review)}
					title={reviewTitle}
				>
					{details?.reviewDecision === "APPROVED" ? (
						<LuCheck className={cn("size-3.5", PR_GREEN_TEXT_CLASS_NAME)} />
					) : details?.reviewDecision === "CHANGES_REQUESTED" ? (
						<LuMessageSquareWarning
							className={cn("size-3.5", PR_RED_TEXT_CLASS_NAME)}
						/>
					) : details?.reviewDecision === "REVIEW_REQUIRED" ? (
						<LuEye className="size-3.5 text-muted-foreground" />
					) : null}
				</span>
				<span
					className={cn("flex shrink-0", MY_PULL_REQUEST_COLUMNS.conflicts)}
					title={
						details?.mergeable === "CONFLICTING"
							? t`Conflicts with the base branch`
							: undefined
					}
				>
					{details?.mergeable === "CONFLICTING" && (
						<LuGitMerge className={cn("size-3.5", PR_RED_TEXT_CLASS_NAME)} />
					)}
				</span>
				<span
					className={cn(
						NUMBER_CELL,
						"text-muted-foreground",
						MY_PULL_REQUEST_COLUMNS.size,
					)}
					title={
						hasSize ? t`+${additions ?? 0} −${deletions ?? 0} lines` : undefined
					}
				>
					{hasSize ? compactCount((additions ?? 0) + (deletions ?? 0)) : "–"}
				</span>
				<span
					className={cn(
						NUMBER_CELL,
						"text-muted-foreground",
						MY_PULL_REQUEST_COLUMNS.age,
					)}
					title={createdAgo ? t`Opened ${createdAgo} ago` : undefined}
				>
					{createdAgo ?? "–"}
				</span>
				<span
					className={cn(
						NUMBER_CELL,
						"text-muted-foreground",
						MY_PULL_REQUEST_COLUMNS.activity,
					)}
					title={updatedAgo ? t`Last activity ${updatedAgo} ago` : undefined}
				>
					{updatedAgo ?? "–"}
				</span>
				<span
					className={cn("shrink-0", MY_PULL_REQUEST_COLUMNS.who)}
					title={person ? `@${person}` : undefined}
				>
					{person && (
						<Avatar className="size-4 rounded-full ring-1 ring-border/50">
							<AvatarImage
								src={`https://github.com/${person}.png?size=32`}
								alt={person}
							/>
							<AvatarFallback className="text-[8px]">
								{person.slice(0, 1).toUpperCase()}
							</AvatarFallback>
						</Avatar>
					)}
				</span>
				<span
					className={cn(
						"flex shrink-0 justify-center",
						MY_PULL_REQUEST_COLUMNS.link,
					)}
				>
					{conversation ? (
						<button
							type="button"
							title={t`Open conversation: ${conversation.title}`}
							aria-label={t`Open conversation: ${conversation.title}`}
							className="relative flex rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
							onClick={(event) => {
								event.stopPropagation();
								onOpenConversation(conversation);
							}}
						>
							<LuBot className="size-3.5" />
							<span
								className={cn(
									"absolute right-0 bottom-0 size-1.5 rounded-full",
									DOT_CLASS[conversation.state],
								)}
							/>
						</button>
					) : workspace ? (
						<button
							type="button"
							title={t`Open workspace: ${getV2WorkspaceDisplayName(workspace)}`}
							aria-label={t`Open workspace`}
							className="flex rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
							onClick={(event) => {
								event.stopPropagation();
								onOpenWorkspace(workspace.id);
							}}
						>
							<LuGitBranch className="size-3.5" />
						</button>
					) : null}
				</span>
				<span
					className={cn(
						"flex shrink-0 justify-center",
						MY_PULL_REQUEST_COLUMNS.menu,
					)}
				>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								aria-label={t`More actions`}
								className="flex rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
								onClick={(event) => event.stopPropagation()}
							>
								<LuEllipsis className="size-3.5" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							onClick={(event) => event.stopPropagation()}
						>
							<DropdownMenuItem onSelect={onTogglePinned}>
								{isPinned ? (
									<LuPinOff className="size-3.5" />
								) : (
									<LuPin className="size-3.5" />
								)}
								{pinLabel}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onToggleLater}>
								{isLater ? (
									<LuArrowUp className="size-3.5" />
								) : (
									<LuArrowDown className="size-3.5" />
								)}
								{isLater ? t`Back to its place` : t`Move to later`}
							</DropdownMenuItem>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger className="gap-2">
									<LuFolderInput className="size-3.5" />
									{t`Move to project…`}
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent className="min-w-44">
									<DropdownMenuRadioGroup
										value={projectId}
										onValueChange={onMoveToProject}
									>
										{projects.map((project) => (
											<DropdownMenuRadioItem
												key={project.id}
												value={project.id}
											>
												{project.name}
											</DropdownMenuRadioItem>
										))}
										<DropdownMenuRadioItem value={OTHER_PROJECT_ID}>
											{t`Other`}
										</DropdownMenuRadioItem>
									</DropdownMenuRadioGroup>
									{isMovedByHand && (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem onSelect={() => onMoveToProject(null)}>
												{t`Back to the project its rules pick`}
											</DropdownMenuItem>
										</>
									)}
								</DropdownMenuSubContent>
							</DropdownMenuSub>
							<DropdownMenuItem onSelect={onOpenOnGitHub}>
								<LuExternalLink className="size-3.5" />
								{t`Open on GitHub`}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</span>
			</div>
			{statusLine}
		</div>
	);
}
