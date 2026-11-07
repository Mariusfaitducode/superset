import { useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { useMemo, useState } from "react";
import { LuLayers, LuMonitor, LuPlus, LuServer } from "react-icons/lu";
import { useKnownHosts } from "renderer/hooks/known-hosts/useKnownHosts";
import { SetUpOverSshDialog } from "renderer/routes/_authenticated/components/SetUpOverSshDialog";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";
import {
	type SidebarStatusWorkspaceRef,
	useSidebarWorkspaceStatuses,
} from "../../providers/DashboardSidebarWorkspaceStatusProvider";
import { HostChip } from "./components/HostChip";
import { type HostAgentCounts, summarizeHosts } from "./utils/summarizeHosts";

interface DashboardSidebarHostSwitcherProps {
	/** Every workspace the sidebar can show, so the counts ignore its filters. */
	workspaces: SidebarStatusWorkspaceRef[];
	selectedMachineId: string | null;
	onSelect: (machineId: string | null) => void;
}

/**
 * Picks the host whose projects and sessions the sidebar shows, with each
 * host's agents counted by state. Hidden while the user has a single host.
 */
export function DashboardSidebarHostSwitcher({
	workspaces,
	selectedMachineId,
	onSelect,
}: DashboardSidebarHostSwitcherProps) {
	const { t } = useLingui();
	const [sshDialogOpen, setSshDialogOpen] = useState(false);
	const { hosts: knownHosts } = useKnownHosts();
	const { machineId: localMachineId } = useLocalHostService();
	const statuses = useSidebarWorkspaceStatuses();
	const { hosts, total } = useMemo(
		() =>
			summarizeHosts({
				hosts: knownHosts,
				localMachineId,
				workspaces,
				agentStatuses: (workspaceId) =>
					statuses.get(workspaceId)?.statuses.values(),
			}),
		[knownHosts, localMachineId, workspaces, statuses],
	);
	if (hosts.length < 2) return null;

	const countsLine = ({ working, needsYou, idle }: HostAgentCounts) =>
		t({
			message: `${working} working · ${needsYou} waiting for you · ${idle} idle`,
		});
	const thisDeviceLabel = (hostName: string) =>
		t({ message: `${hostName} (this device)` });

	return (
		<>
			<fieldset
				aria-label={t({ message: "Hosts" })}
				className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 px-3 pt-1 pb-2"
			>
				<HostChip
					isSelected={selectedMachineId === null}
					onClick={() => onSelect(null)}
					icon={<LuLayers className="size-3" />}
					label={t({ message: "All" })}
					counts={total}
					tooltip={
						<>
							<div>{t({ message: "Every host" })}</div>
							<div className="text-muted-foreground">{countsLine(total)}</div>
						</>
					}
				/>
				{hosts.map((host) => (
					<HostChip
						key={host.machineId}
						isSelected={selectedMachineId === host.machineId}
						onClick={() => onSelect(host.machineId)}
						icon={
							host.isLocal ? (
								<LuMonitor className="size-3" />
							) : (
								<LuServer className="size-3" />
							)
						}
						label={host.name}
						isOnline={host.isOnline}
						counts={host.counts}
						tooltip={
							<>
								<div>
									{host.isLocal ? thisDeviceLabel(host.name) : host.name}
									{" · "}
									{host.isOnline
										? t({ message: "Online" })
										: t({ message: "Offline" })}
								</div>
								<div className="text-muted-foreground">
									{countsLine(host.counts)}
								</div>
							</>
						}
					/>
				))}
				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={() => setSshDialogOpen(true)}
							aria-label={t({ message: "Set up a host over SSH" })}
							className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
						>
							<LuPlus className="size-3" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						{t({ message: "Set up a host over SSH" })}
					</TooltipContent>
				</Tooltip>
			</fieldset>
			<SetUpOverSshDialog
				open={sshDialogOpen}
				onOpenChange={setSshDialogOpen}
			/>
		</>
	);
}
