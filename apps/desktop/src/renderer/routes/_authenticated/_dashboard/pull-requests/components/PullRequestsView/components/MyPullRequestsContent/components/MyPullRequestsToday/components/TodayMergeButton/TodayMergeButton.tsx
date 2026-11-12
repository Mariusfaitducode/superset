import { Trans, useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import {
	AlertDialog,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	EnterEnabledAlertDialogContent,
} from "@superset/ui/alert-dialog";
import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { LuGitMerge } from "react-icons/lu";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";

interface TodayMergeButtonProps {
	projectId: string;
	hostUrl: string;
	prNumber: number;
	title: string;
	onMerged: () => void;
}

export function TodayMergeButton({
	projectId,
	hostUrl,
	prNumber,
	title,
	onMerged,
}: TodayMergeButtonProps) {
	const { t } = useLingui();
	const [isConfirming, setIsConfirming] = useState(false);
	const merge = useMutation({
		mutationFn: () =>
			getHostServiceClientByUrl(hostUrl).pullRequests.mergePR.mutate({
				projectId,
				prNumber,
				mergeMethod: "squash",
			}),
		onSuccess: () => {
			toast.success(t`Merged #${prNumber}`);
			onMerged();
		},
		onError: (error) => {
			toast.error(t`Couldn't merge pull request`, {
				description: errorMessage(error),
			});
		},
	});

	return (
		<>
			<Button
				size="xs"
				className="h-6 gap-1 px-2"
				disabled={merge.isPending}
				onClick={(event) => {
					event.stopPropagation();
					setIsConfirming(true);
				}}
			>
				<LuGitMerge className="size-3" />
				{merge.isPending ? <Trans>Merging…</Trans> : <Trans>Merge</Trans>}
			</Button>
			<AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
				<EnterEnabledAlertDialogContent
					className="max-w-[360px] gap-0 p-0"
					onClick={(event) => event.stopPropagation()}
				>
					<AlertDialogHeader className="px-4 pt-4 pb-2">
						<AlertDialogTitle className="font-medium">
							<Trans>Squash and merge #{prNumber}?</Trans>
						</AlertDialogTitle>
						<AlertDialogDescription>
							<Trans>
								"{title}" will be squashed and merged on GitHub. This can't be
								undone from here.
							</Trans>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="flex-row justify-end gap-2 px-4 pt-2 pb-4">
						<Button
							variant="ghost"
							size="sm"
							className="h-7 px-3 text-xs"
							onClick={() => setIsConfirming(false)}
						>
							<Trans>Cancel</Trans>
						</Button>
						<Button
							size="sm"
							className="h-7 px-3 text-xs"
							onClick={() => {
								setIsConfirming(false);
								merge.mutate();
							}}
						>
							<Trans>Merge</Trans>
						</Button>
					</AlertDialogFooter>
				</EnterEnabledAlertDialogContent>
			</AlertDialog>
		</>
	);
}
