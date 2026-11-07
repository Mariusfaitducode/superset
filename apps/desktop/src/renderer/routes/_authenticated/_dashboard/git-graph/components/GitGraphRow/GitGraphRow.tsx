import { useLingui } from "@lingui/react/macro";
import { formatDateTime } from "@superset/i18n/format";
import { cn } from "@superset/ui/utils";
import { memo } from "react";
import { LuBot, LuFolderGit2, LuGitBranch, LuTag } from "react-icons/lu";
import type { AgentConversation } from "renderer/hooks/useAgentConversations";
import { DOT_CLASS } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/DashboardSidebarConversationList";
import type { HostWorkspaceItem } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import type { RefBadge } from "../../utils/buildRefBadges";
import type { GraphRowLayout } from "../../utils/layoutGitGraph";
import {
	GitGraphCell,
	GRAPH_LANE_WIDTH,
	GRAPH_ROW_HEIGHT,
	laneColor,
} from "../GitGraphCell";

export type GitGraphBadge = RefBadge<HostWorkspaceItem, AgentConversation>;

export interface GitGraphRowCommit {
	hash: string;
	parents: string[];
	authorName: string;
	authorEmail: string;
	authoredAt: number;
	subject: string;
}

/** Column widths shared with the header. */
export const GIT_GRAPH_COLUMNS = {
	date: "hidden w-32 @3xl:block",
	author: "hidden w-28 @2xl:block",
	hash: "w-16",
} as const;

interface GitGraphRowProps {
	commit: GitGraphRowCommit;
	layout: GraphRowLayout;
	graphWidth: number;
	badges: GitGraphBadge[];
	isDimmed: boolean;
	isSelected: boolean;
	onSelect: () => void;
	onOpenWorkspace: (workspaceId: string) => void;
	onOpenConversation: (conversation: AgentConversation) => void;
	onFilterRef: (ref: string) => void;
}

export const GitGraphRow = memo(function GitGraphRow({
	commit,
	layout,
	graphWidth,
	badges,
	isDimmed,
	isSelected,
	onSelect,
	onOpenWorkspace,
	onOpenConversation,
	onFilterRef,
}: GitGraphRowProps) {
	const { t } = useLingui();
	const color = laneColor(layout.color);
	return (
		// biome-ignore lint/a11y/useSemanticElements: row is a composite list item, not a native control
		<div
			className={cn(
				"flex items-center gap-2 pr-3 text-xs hover:bg-accent/50",
				isSelected && "bg-accent",
			)}
			style={{ height: GRAPH_ROW_HEIGHT }}
			onClick={onSelect}
			onKeyDown={(event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onSelect();
				}
			}}
			role="button"
			tabIndex={0}
			aria-current={isSelected ? "true" : undefined}
		>
			<div
				className="shrink-0 overflow-hidden pl-2"
				style={{ width: graphWidth }}
			>
				<GitGraphCell
					row={layout}
					width={(layout.width + 1) * GRAPH_LANE_WIDTH}
					isMerge={commit.parents.length > 1}
					isDimmed={isDimmed}
				/>
			</div>
			<div
				className={cn(
					"flex min-w-0 flex-1 items-center gap-1.5",
					isDimmed && "opacity-40",
				)}
			>
				{badges.map((badge) => (
					<Badge
						key={badge.kind === "head" ? "HEAD" : badge.ref}
						badge={badge}
						color={color}
						onOpenWorkspace={onOpenWorkspace}
						onOpenConversation={onOpenConversation}
						onFilterRef={onFilterRef}
					/>
				))}
				<span
					className={cn(
						"truncate",
						commit.parents.length > 1
							? "text-muted-foreground"
							: "text-foreground",
					)}
					title={commit.subject}
				>
					{commit.subject}
				</span>
			</div>
			<span
				className={cn(
					"shrink-0 truncate text-muted-foreground tabular-nums",
					GIT_GRAPH_COLUMNS.date,
					isDimmed && "opacity-40",
				)}
			>
				{formatDateTime(commit.authoredAt * 1000)}
			</span>
			<span
				className={cn(
					"shrink-0 truncate text-muted-foreground",
					GIT_GRAPH_COLUMNS.author,
					isDimmed && "opacity-40",
				)}
				title={`${commit.authorName} <${commit.authorEmail}>`}
			>
				{commit.authorName}
			</span>
			<button
				type="button"
				className={cn(
					"shrink-0 rounded text-left font-mono text-[11px] text-muted-foreground hover:text-foreground",
					GIT_GRAPH_COLUMNS.hash,
					isDimmed && "opacity-40",
				)}
				title={t`Copy ${commit.hash}`}
				onClick={(event) => {
					event.stopPropagation();
					void navigator.clipboard.writeText(commit.hash);
				}}
			>
				{commit.hash.slice(0, 8)}
			</button>
		</div>
	);
});

function Badge({
	badge,
	color,
	onOpenWorkspace,
	onOpenConversation,
	onFilterRef,
}: {
	badge: GitGraphBadge;
	color: string;
	onOpenWorkspace: (workspaceId: string) => void;
	onOpenConversation: (conversation: AgentConversation) => void;
	onFilterRef: (ref: string) => void;
}) {
	const { t } = useLingui();
	const chip =
		"flex h-5 min-w-0 max-w-64 shrink-0 items-center gap-1 rounded border px-1.5 text-[11px]";
	if (badge.kind === "head") {
		return <span className={cn(chip, "border-border font-medium")}>HEAD</span>;
	}
	if (badge.kind === "tag") {
		return (
			<button
				type="button"
				className={cn(
					chip,
					"border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20",
				)}
				title={t`Show only ${badge.label}`}
				onClick={(event) => {
					event.stopPropagation();
					onFilterRef(badge.ref);
				}}
			>
				<LuTag className="size-3 shrink-0" />
				<span className="truncate">{badge.label}</span>
			</button>
		);
	}
	if (badge.kind === "remote") {
		return (
			<button
				type="button"
				className={cn(
					chip,
					"border-dashed text-muted-foreground hover:bg-accent",
				)}
				title={t`Show only ${badge.label}`}
				onClick={(event) => {
					event.stopPropagation();
					onFilterRef(badge.ref);
				}}
			>
				<LuGitBranch className="size-3 shrink-0" />
				<span className="truncate">{badge.label}</span>
			</button>
		);
	}
	const { workspace, conversation, worktreePath } = badge;
	return (
		<span
			className={cn(
				chip,
				"overflow-hidden p-0",
				badge.isHead && "font-semibold",
			)}
			style={{ borderColor: color }}
		>
			<button
				type="button"
				className="flex h-full min-w-0 items-center gap-1 px-1.5 hover:bg-accent"
				style={{ backgroundColor: `${color}22` }}
				title={t`Show only ${badge.label}`}
				onClick={(event) => {
					event.stopPropagation();
					onFilterRef(badge.ref);
				}}
			>
				<LuGitBranch className="size-3 shrink-0" style={{ color }} />
				<span className="truncate">{badge.label}</span>
			</button>
			{badge.syncedRemotes.length > 0 && (
				<span
					className="flex h-full shrink-0 items-center border-l px-1 italic text-muted-foreground"
					title={t`In sync with ${badge.syncedRemotes.join(", ")}`}
				>
					{badge.syncedRemotes.join(", ")}
				</span>
			)}
			{conversation ? (
				<button
					type="button"
					className="flex h-full min-w-0 max-w-40 items-center gap-1 border-l px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
					title={t`Open conversation: ${conversation.title}`}
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
					className="flex h-full items-center border-l px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
					title={t`Open workspace`}
					onClick={(event) => {
						event.stopPropagation();
						onOpenWorkspace(workspace.id);
					}}
				>
					<LuFolderGit2 className="size-3" />
				</button>
			) : worktreePath ? (
				<span
					className="flex h-full items-center border-l px-1.5 text-muted-foreground"
					title={t`Worktree: ${worktreePath}`}
				>
					<LuFolderGit2 className="size-3" />
				</span>
			) : null}
		</span>
	);
}
