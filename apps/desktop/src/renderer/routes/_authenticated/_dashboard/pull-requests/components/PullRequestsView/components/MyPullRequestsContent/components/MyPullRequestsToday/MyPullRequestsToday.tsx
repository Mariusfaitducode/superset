import { Trans } from "@lingui/react/macro";
import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import type { TodayItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pickTodayPullRequests";
import { TodayCard, type TodayHost } from "./components/TodayCard";

interface MyPullRequestsTodayProps {
	items: TodayItem[];
	hostByProject: Map<string, TodayHost>;
	isSelected: (pr: MyPullRequestItem) => boolean;
	onOpen: (pr: MyPullRequestItem) => void;
	onOpenOnGitHub: (pr: MyPullRequestItem) => void;
	onNotToday: (key: string) => void;
	onChanged: () => void;
}

/** The few PRs to handle first, each with the one action it asks for. */
export function MyPullRequestsToday({
	items,
	hostByProject,
	isSelected,
	onOpen,
	onOpenOnGitHub,
	onNotToday,
	onChanged,
}: MyPullRequestsTodayProps) {
	return (
		<section className="flex flex-col gap-1 border-b bg-muted/20 px-2 pt-2 pb-2.5">
			<h3 className="flex items-baseline gap-2 px-2 text-[11px]">
				<span className="font-medium text-foreground">
					<Trans>Today</Trans>
				</span>
				<span className="text-muted-foreground tabular-nums">
					{items.length}
				</span>
				<span className="truncate text-muted-foreground/70">
					<Trans>Merge, then reviews, then your blocked PRs</Trans>
				</span>
			</h3>
			{items.map((item) => (
				<TodayCard
					key={item.row.key}
					item={item}
					host={hostByProject.get(item.row.pr.projectId) ?? null}
					isSelected={isSelected(item.row.pr)}
					onOpen={() => onOpen(item.row.pr)}
					onOpenOnGitHub={() => onOpenOnGitHub(item.row.pr)}
					onNotToday={() => onNotToday(item.row.key)}
					onChanged={onChanged}
				/>
			))}
		</section>
	);
}
