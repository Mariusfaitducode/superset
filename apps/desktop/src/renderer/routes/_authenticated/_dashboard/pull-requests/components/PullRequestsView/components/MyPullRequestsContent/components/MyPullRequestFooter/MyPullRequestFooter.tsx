import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { LuBot, LuGitBranch } from "react-icons/lu";
import type { AgentConversation } from "renderer/hooks/useAgentConversations";
import { DOT_CLASS } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/DashboardSidebarConversationList";
import {
	PR_GREEN_TEXT_CLASS_NAME,
	PR_RED_TEXT_CLASS_NAME,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/components/pull-request-colors";
import type {
	MyPullRequestReason,
	MyPullRequestStatus,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import type { HostWorkspaceItem } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { getV2WorkspaceDisplayName } from "renderer/utils/getV2WorkspaceDisplayName";

const REASON_CLASS: Record<MyPullRequestReason, string> = {
	"review-requested": "bg-amber-500/15 text-amber-700 [.dark_&]:text-amber-300",
	conflicts: cn("bg-red-500/10", PR_RED_TEXT_CLASS_NAME),
	"ci-failing": cn("bg-red-500/10", PR_RED_TEXT_CLASS_NAME),
	"changes-requested": cn("bg-red-500/10", PR_RED_TEXT_CLASS_NAME),
	draft: "bg-muted text-foreground",
	"ready-to-merge": cn("bg-emerald-500/10", PR_GREEN_TEXT_CLASS_NAME),
	"ci-running": "bg-muted text-muted-foreground",
	"awaiting-review": "bg-muted text-muted-foreground",
	following: "bg-muted text-muted-foreground",
};

export function MyPullRequestFooter({
	status,
	reasonLabel,
	workspace,
	conversation,
	onOpenWorkspace,
	onOpenConversation,
}: {
	status: MyPullRequestStatus;
	reasonLabel: Record<MyPullRequestReason, string>;
	workspace: HostWorkspaceItem | undefined;
	conversation: AgentConversation | null;
	onOpenWorkspace: (workspaceId: string) => void;
	onOpenConversation: (conversation: AgentConversation) => void;
}) {
	const { t } = useLingui();
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-1 pt-0.5">
			{status.reasons.map((reason) => (
				<span
					key={reason}
					className={cn(
						"shrink-0 rounded px-1.5 py-px text-[10px] font-medium",
						REASON_CLASS[reason],
					)}
				>
					{reasonLabel[reason]}
				</span>
			))}
			{conversation ? (
				<button
					type="button"
					title={t`Open conversation: ${conversation.title}`}
					className="flex min-w-0 max-w-48 items-center gap-1 rounded px-1 py-px text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
					onClick={(event) => {
						event.stopPropagation();
						onOpenConversation(conversation);
					}}
				>
					<span className="relative flex shrink-0">
						<LuBot className="size-3" />
						<span
							className={cn(
								"absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full",
								DOT_CLASS[conversation.state],
							)}
						/>
					</span>
					<span className="truncate">{conversation.title}</span>
				</button>
			) : workspace ? (
				<button
					type="button"
					title={t`Open workspace`}
					className="flex min-w-0 max-w-48 items-center gap-1 rounded px-1 py-px text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
					onClick={(event) => {
						event.stopPropagation();
						onOpenWorkspace(workspace.id);
					}}
				>
					<LuGitBranch className="size-3 shrink-0" />
					<span className="truncate">
						{getV2WorkspaceDisplayName(workspace)}
					</span>
				</button>
			) : null}
		</div>
	);
}
