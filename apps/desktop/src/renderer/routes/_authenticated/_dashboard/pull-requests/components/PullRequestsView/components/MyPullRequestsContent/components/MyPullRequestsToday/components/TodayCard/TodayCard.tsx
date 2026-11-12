import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import { LuClock, LuExternalLink, LuEye } from "react-icons/lu";
import type { TodayItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pickTodayPullRequests";
import { whyLabel } from "../../../../utils/myPullRequestLabels";
import { TodayFixButton } from "../TodayFixButton";
import { TodayMergeButton } from "../TodayMergeButton";
import { TodayUpdateButton } from "../TodayUpdateButton";

export interface TodayHost {
	hostId: string;
	hostUrl: string;
}

interface TodayCardProps {
	item: TodayItem;
	host: TodayHost | null;
	isSelected: boolean;
	onOpen: () => void;
	onOpenOnGitHub: () => void;
	onNotToday: () => void;
	onChanged: () => void;
}

export function TodayCard({
	item,
	host,
	isSelected,
	onOpen,
	onOpenOnGitHub,
	onNotToday,
	onChanged,
}: TodayCardProps) {
	const { t } = useLingui();
	const { row, verb } = item;
	const { pr } = row;
	const stackedOn = row.stackedOn;

	const action = (() => {
		switch (verb) {
			case "merge":
				return host ? (
					<TodayMergeButton
						projectId={pr.projectId}
						hostUrl={host.hostUrl}
						prNumber={pr.prNumber}
						title={pr.title}
						onMerged={onChanged}
					/>
				) : null;
			case "update":
				return host ? (
					<TodayUpdateButton
						projectId={pr.projectId}
						hostUrl={host.hostUrl}
						prNumber={pr.prNumber}
						onUpdated={onChanged}
					/>
				) : null;
			case "fix":
				return host ? (
					<TodayFixButton
						projectId={pr.projectId}
						hostId={host.hostId}
						hostUrl={host.hostUrl}
						prNumber={pr.prNumber}
						repoFullName={pr.repoFullName}
						hasConflicts={row.why.kind === "conflicts"}
					/>
				) : null;
			case "review":
			case "re-review":
				return (
					<Button
						variant="outline"
						size="xs"
						className="h-6 gap-1 px-2"
						onClick={(event) => {
							event.stopPropagation();
							onOpen();
						}}
					>
						<LuEye className="size-3" />
						{verb === "review" ? (
							<Trans>Review</Trans>
						) : (
							<Trans>Re-review</Trans>
						)}
					</Button>
				);
			case "ask":
				return (
					<Button
						variant="outline"
						size="xs"
						className="h-6 gap-1 px-2"
						title={t`Request reviewers on GitHub`}
						onClick={(event) => {
							event.stopPropagation();
							onOpenOnGitHub();
						}}
					>
						<LuExternalLink className="size-3" />
						<Trans>Ask for a review</Trans>
					</Button>
				);
		}
	})();

	return (
		// biome-ignore lint/a11y/useSemanticElements: the card holds its own buttons, so it cannot be a <button>
		<div
			role="button"
			tabIndex={0}
			aria-current={isSelected ? "true" : undefined}
			className={cn(
				"group flex min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				isSelected && "bg-accent",
			)}
			onClick={onOpen}
			onKeyDown={(event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onOpen();
				}
			}}
		>
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex min-w-0 items-baseline gap-1.5">
					<span className="truncate text-[13px] font-medium">{pr.title}</span>
					<span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
						{pr.repoFullName.split("/").at(-1)}#{pr.prNumber}
					</span>
				</div>
				<div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
					<span className="truncate">{whyLabel(row.why)}</span>
					{stackedOn !== null && (
						<span className="shrink-0">
							· <Trans>stacked on #{stackedOn}</Trans>
						</span>
					)}
				</div>
			</div>
			<Button
				variant="ghost"
				size="icon-xs"
				className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
				title={t`Not today: move it to Later`}
				aria-label={t`Not today: move it to Later`}
				onClick={(event) => {
					event.stopPropagation();
					onNotToday();
				}}
			>
				<LuClock className="size-3.5" />
			</Button>
			<div className="shrink-0">{action}</div>
		</div>
	);
}
