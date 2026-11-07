import { useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { LuCheck, LuGitBranch, LuListChecks, LuX } from "react-icons/lu";
import { useNow } from "renderer/hooks/useNow";
import type { OpenTodoCount } from "../../../../../../hooks/useWorkspaceOpenTodos";
import type { DashboardSidebarWorkspacePullRequest } from "../../../../../../types";
import { PR_COLOR_BY_STATE } from "../../../DashboardSidebarWorkspaceIcon";

const CHECKS_GLYPH: Record<
	DashboardSidebarWorkspacePullRequest["checksStatus"],
	ReactNode
> = {
	success: <LuCheck className="size-3 text-emerald-500" strokeWidth={2.5} />,
	failure: (
		<LuX
			className="size-3 text-[color:var(--sb-state-failed)]"
			strokeWidth={2.5}
		/>
	),
	pending: (
		<span className="size-1.5 rounded-full bg-[var(--sb-state-working)]" />
	),
	none: null,
};

function stopRowEvent(event: { stopPropagation: () => void }) {
	event.stopPropagation();
}

/**
 * The muted line under a workspace's name: its branch, its PR with the
 * checks, its open to-dos and how long it has waited on the user. Renders
 * nothing when there is nothing to say.
 */
export function DashboardSidebarWorkspaceDetails({
	hostGlyph,
	branch,
	pullRequest,
	onPullRequestClick,
	todos,
	waitingSince,
}: {
	/** Where it runs, when not on this device. */
	hostGlyph: ReactNode;
	branch: string | null;
	pullRequest: DashboardSidebarWorkspacePullRequest | null;
	onPullRequestClick: () => void;
	todos: OpenTodoCount | null;
	/** Host clock, ms. */
	waitingSince: number | null;
}) {
	const { t } = useLingui();
	// Minutes are the finest unit shown.
	const now = useNow(30_000).getTime();
	const hasTodos = todos !== null && todos.open > 0;
	if (!hostGlyph && !branch && !pullRequest && !hasTodos && !waitingSince) {
		return null;
	}

	const checksLabel: Record<
		DashboardSidebarWorkspacePullRequest["checksStatus"],
		string
	> = {
		success: t`Checks passed`,
		failure: t`Checks failed`,
		pending: t`Checks running`,
		none: "",
	};

	return (
		<div className="flex h-4 min-w-0 items-center gap-2 text-[11px] leading-none text-muted-foreground">
			{hostGlyph}
			{branch && (
				<span className="flex min-w-0 items-center gap-0.5" title={branch}>
					<LuGitBranch className="size-3 shrink-0" strokeWidth={1.75} />
					<span className="truncate">{branch}</span>
				</span>
			)}
			{pullRequest && (
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						onPullRequestClick();
					}}
					onMouseDown={stopRowEvent}
					onDoubleClick={stopRowEvent}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.stopPropagation();
						}
					}}
					title={[
						t`Open pull request #${pullRequest.number}`,
						checksLabel[pullRequest.checksStatus],
					]
						.filter(Boolean)
						.join(" · ")}
					className="flex shrink-0 items-center gap-0.5 rounded-sm px-0.5 tabular-nums hover:bg-foreground/10 hover:text-foreground"
				>
					<span className={PR_COLOR_BY_STATE[pullRequest.state]}>
						#{pullRequest.number}
					</span>
					{CHECKS_GLYPH[pullRequest.checksStatus]}
				</button>
			)}
			{hasTodos && (
				<span
					className={cn(
						"flex shrink-0 items-center gap-0.5 tabular-nums",
						todos.urgent && "text-[color:var(--sb-state-failed)]",
					)}
					title={
						todos.urgent
							? t`${todos.open} open to-dos, some high priority`
							: t`${todos.open} open to-dos`
					}
				>
					<LuListChecks className="size-3" />
					{todos.open}
				</span>
			)}
			{waitingSince !== null && (
				<span
					className="ml-auto shrink-0 tabular-nums"
					title={t`Waiting on you`}
				>
					{formatCompactRelativeTime(Math.min(waitingSince, now), now)}
				</span>
			)}
		</div>
	);
}
