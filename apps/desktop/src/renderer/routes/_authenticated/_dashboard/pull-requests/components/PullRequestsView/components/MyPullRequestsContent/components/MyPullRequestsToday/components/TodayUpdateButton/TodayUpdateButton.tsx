import { Trans, useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { useMutation } from "@tanstack/react-query";
import { LuGitPullRequestArrow } from "react-icons/lu";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";

interface TodayUpdateButtonProps {
	projectId: string;
	hostUrl: string;
	prNumber: number;
	onUpdated: () => void;
}

export function TodayUpdateButton({
	projectId,
	hostUrl,
	prNumber,
	onUpdated,
}: TodayUpdateButtonProps) {
	const { t } = useLingui();
	const update = useMutation({
		mutationFn: () =>
			getHostServiceClientByUrl(hostUrl).pullRequests.updateBranch.mutate({
				projectId,
				prNumber,
			}),
		onSuccess: () => {
			toast.success(t`Updating the branch of #${prNumber}`, {
				description: t`CI runs again on the new commit.`,
			});
			onUpdated();
		},
		onError: (error) => {
			toast.error(t`Couldn't update the branch`, {
				description: errorMessage(error),
			});
		},
	});

	return (
		<Button
			variant="outline"
			size="xs"
			className="h-6 gap-1 px-2"
			disabled={update.isPending}
			onClick={(event) => {
				event.stopPropagation();
				update.mutate();
			}}
		>
			<LuGitPullRequestArrow className="size-3" />
			{update.isPending ? (
				<Trans>Updating…</Trans>
			) : (
				<Trans>Update branch</Trans>
			)}
		</Button>
	);
}
