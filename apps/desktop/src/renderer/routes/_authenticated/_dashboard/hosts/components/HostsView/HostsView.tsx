import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { useState } from "react";
import { LuMonitor, LuPlus, LuServer } from "react-icons/lu";
import { HostChip } from "renderer/routes/_authenticated/_dashboard/components/HostChip";
import { SetUpOverSshDialog } from "renderer/routes/_authenticated/components/SetUpOverSshDialog";
import { useHostsAgents } from "../../hooks/useHostsAgents";
import { HostPanel } from "./components/HostPanel";

interface HostsViewProps {
	selectedMachineId: string | null;
	onSelect: (machineId: string) => void;
}

/**
 * Every machine this account reaches, each with its agents: pick one to see
 * its workspaces, open, stop or start agents there, or wake it.
 */
export function HostsView({ selectedMachineId, onSelect }: HostsViewProps) {
	const { t } = useLingui();
	const [sshDialogOpen, setSshDialogOpen] = useState(false);
	const data = useHostsAgents();
	const selected =
		data.summaries.find((host) => host.machineId === selectedMachineId) ??
		data.summaries[0] ??
		null;
	const thisDeviceLabel = (hostName: string) =>
		t({ message: `${hostName} (this device)` });

	return (
		<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex w-full max-w-3xl flex-col px-8 pt-4 pb-12">
					<div className="flex items-center justify-between gap-2">
						<h1 className="font-semibold text-xl tracking-tight">
							<Trans>Hosts</Trans>
						</h1>
						<Button
							size="sm"
							variant="outline"
							className="gap-1.5"
							onClick={() => setSshDialogOpen(true)}
						>
							<LuPlus className="size-3.5" />
							<Trans>Set up a host over SSH</Trans>
						</Button>
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
						<Trans>
							Every machine you reach, with the agents running on it.
						</Trans>
					</p>

					{data.summaries.length > 0 && (
						<div className="mt-6 flex flex-wrap items-center gap-1.5">
							{data.summaries.map((host) => (
								<HostChip
									key={host.machineId}
									size="md"
									isSelected={host.machineId === selected?.machineId}
									onClick={() => onSelect(host.machineId)}
									icon={
										host.isLocal ? (
											<LuMonitor className="size-3.5" />
										) : (
											<LuServer className="size-3.5" />
										)
									}
									label={host.name}
									isOnline={host.isOnline}
									counts={host.counts}
									tooltip={
										host.isLocal ? thisDeviceLabel(host.name) : host.name
									}
								/>
							))}
						</div>
					)}

					<div className="mt-6">
						{selected ? (
							<HostPanel key={selected.machineId} host={selected} data={data} />
						) : (
							data.settled && (
								<p className="mt-12 text-center text-muted-foreground text-sm">
									<Trans>No hosts yet.</Trans>
								</p>
							)
						)}
					</div>
				</div>
			</div>
			<SetUpOverSshDialog
				open={sshDialogOpen}
				onOpenChange={setSshDialogOpen}
			/>
		</div>
	);
}
