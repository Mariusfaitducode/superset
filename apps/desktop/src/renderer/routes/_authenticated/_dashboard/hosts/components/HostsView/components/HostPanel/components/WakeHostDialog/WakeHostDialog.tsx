import { Trans } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { useState } from "react";
import { LuCheck, LuTriangleAlert } from "react-icons/lu";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { CommandTerminal } from "renderer/routes/_authenticated/components/CommandTerminal";
import { buildHostsWakeCommand } from "./utils/buildHostsWakeCommand";

interface WakeHostDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	machineId: string;
	hostName: string;
}

type Phase = "running" | "done" | "failed";

/** Runs `superset hosts wake` for the host and shows its output. */
export function WakeHostDialog({
	open,
	onOpenChange,
	machineId,
	hostName,
}: WakeHostDialogProps) {
	const organizationId = useActiveOrganizationId();
	const [phase, setPhase] = useState<Phase>("running");
	const [attempt, setAttempt] = useState(0);

	return (
		<Dialog
			open={open}
			modal
			onOpenChange={(next) => {
				if (next) {
					setPhase("running");
					setAttempt((value) => value + 1);
				}
				onOpenChange(next);
			}}
		>
			<DialogContent className="gap-3 sm:max-w-[752px]">
				<DialogHeader>
					<DialogTitle>
						<Trans>Wake {hostName}</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>
							Runs the host's wake command on this machine. The host shows as
							online once it is back.
						</Trans>
					</DialogDescription>
				</DialogHeader>
				{phase === "done" && (
					<div className="flex min-h-11 items-center gap-2.5 rounded-md border bg-muted/40 px-3.5 text-sm">
						<LuCheck className="size-3.5 shrink-0 text-emerald-500" />
						<Trans>
							The wake command ran. The host may take a minute to come online.
						</Trans>
					</div>
				)}
				{phase === "failed" && (
					<div className="flex min-h-11 items-center justify-between gap-2.5 rounded-md border bg-muted/40 px-3.5 text-sm">
						<span className="flex items-center gap-2.5">
							<LuTriangleAlert className="size-3.5 shrink-0 text-destructive" />
							<Trans>
								The host could not be woken. The reason is in the output below.
							</Trans>
						</span>
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								setPhase("running");
								setAttempt((value) => value + 1);
							}}
						>
							<Trans>Retry</Trans>
						</Button>
					</div>
				)}
				{open && organizationId && (
					<div className="h-[260px] w-full overflow-hidden rounded-lg border bg-[#151110] p-3">
						<CommandTerminal
							key={attempt}
							command={buildHostsWakeCommand(machineId, organizationId)}
							onExit={(exitCode) =>
								setPhase(exitCode === 0 ? "done" : "failed")
							}
						/>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
