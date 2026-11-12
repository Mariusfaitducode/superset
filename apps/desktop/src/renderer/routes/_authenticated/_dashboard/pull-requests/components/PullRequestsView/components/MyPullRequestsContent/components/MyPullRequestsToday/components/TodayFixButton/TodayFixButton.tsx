import { Trans, useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { LuBot } from "react-icons/lu";
import { usePullRequestAgentHandoff } from "renderer/routes/_authenticated/_dashboard/pull-requests/hooks/usePullRequestAgentHandoff";
import { usePullRequestDetail } from "renderer/routes/_authenticated/_dashboard/pull-requests/hooks/usePullRequestDetail";
import {
	buildFixFindingsPrompt,
	buildResolveConflictsPrompt,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/buildPullRequestRepairPrompts";

interface TodayFixButtonProps {
	projectId: string;
	hostId: string;
	hostUrl: string;
	prNumber: number;
	repoFullName: string;
	hasConflicts: boolean;
}

/** Hands the PR's findings, or its conflicts, to the agent of its workspace. */
export function TodayFixButton({
	projectId,
	hostId,
	hostUrl,
	prNumber,
	repoFullName,
	hasConflicts,
}: TodayFixButtonProps) {
	const { t } = useLingui();
	// Loaded on click only, so the cards cost no GitHub call until used.
	const detail = usePullRequestDetail({
		projectId,
		hostUrl,
		prNumber,
		repoFullName,
		enabled: false,
	});
	const handoff = usePullRequestAgentHandoff({
		projectId,
		hostId,
		hostUrl,
		prNumber,
	});
	const isPending = detail.isFetching || handoff.isPending;

	const handOff = async () => {
		const { data, error } = await detail.refetch();
		if (!data) {
			toast.error(t`Couldn't hand this to an agent`, {
				description: error ? errorMessage(error) : undefined,
			});
			return;
		}
		handoff.handOff(
			hasConflicts
				? buildResolveConflictsPrompt(data)
				: buildFixFindingsPrompt(data),
		);
	};

	return (
		<Button
			variant="outline"
			size="xs"
			className="h-6 gap-1 px-2"
			disabled={!handoff.available || isPending}
			title={
				handoff.available ? undefined : t`No agent is configured on this host`
			}
			onClick={(event) => {
				event.stopPropagation();
				void handOff();
			}}
		>
			<LuBot className="size-3" />
			{isPending ? (
				<Trans>Handing to agent…</Trans>
			) : (
				<Trans>Fix with agent</Trans>
			)}
		</Button>
	);
}
