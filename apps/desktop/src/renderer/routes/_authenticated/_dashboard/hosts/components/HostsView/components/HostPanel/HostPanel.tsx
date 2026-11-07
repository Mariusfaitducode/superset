import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { cn } from "@superset/ui/utils";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LuChevronRight, LuMoon, LuPower, LuSettings2 } from "react-icons/lu";
import { useV2AgentConfigs } from "renderer/hooks/useV2AgentConfigs";
import type { HostSummary } from "renderer/routes/_authenticated/_dashboard/utils/summarizeHosts";
import { useHostAgentActions } from "../../../../hooks/useHostAgentActions";
import {
	type HostsAgents,
	useHostTerminalTitles,
} from "../../../../hooks/useHostsAgents";
import { groupHostAgents } from "../../../../utils/groupHostAgents";
import { WakeHostDialog } from "./components/WakeHostDialog";
import { WorkspaceAgents } from "./components/WorkspaceAgents";

interface HostPanelProps {
	host: HostSummary;
	data: HostsAgents;
}

/** One host: its workspaces with their live agents, and how to wake it. */
export function HostPanel({ host, data }: HostPanelProps) {
	const { t } = useLingui();
	const [wakeOpen, setWakeOpen] = useState(false);
	const [showQuiet, setShowQuiet] = useState(false);
	const hostUrl = host.isOnline ? data.hostUrlOf(host.machineId) : null;
	const canAct = hostUrl !== null;
	const actions = useHostAgentActions(hostUrl);
	const { data: agentConfigs = [] } = useV2AgentConfigs(hostUrl);
	const titles = useHostTerminalTitles(hostUrl);
	const workspaces = data.workspacesOf(host.machineId);

	const { withAgents, withoutAgents } = useMemo(
		() =>
			groupHostAgents({
				workspaces,
				bindings: workspaces.flatMap((workspace) =>
					data.bindingsOf(workspace.id),
				),
				terminalSeenAt: data.terminalSeenAt,
				titles,
			}),
		[workspaces, data, titles],
	);

	const quietCount = withoutAgents.length;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<span
					className={cn(
						"size-2 shrink-0 rounded-full",
						host.isOnline ? "bg-emerald-500" : "bg-muted-foreground/50",
					)}
				/>
				<h2 className="truncate font-medium text-base">{host.name}</h2>
				<span className="text-muted-foreground text-xs">
					{host.isLocal && t({ message: "This device" })}
					{host.isLocal && " · "}
					{host.isOnline ? t({ message: "Online" }) : t({ message: "Offline" })}
				</span>
				<Button
					asChild
					size="sm"
					variant="ghost"
					className="ml-auto h-7 gap-1.5 text-xs"
				>
					<Link
						to="/settings/hosts/$hostId"
						params={{ hostId: host.machineId }}
					>
						<LuSettings2 className="size-3.5" />
						<Trans>Host settings</Trans>
					</Link>
				</Button>
			</div>

			{!host.isOnline && (
				<div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3.5 py-2.5 text-sm">
					<LuMoon className="size-4 shrink-0 text-muted-foreground" />
					<span className="flex-1 text-muted-foreground">
						<Trans>
							This host is offline, so its agents can't be read or started. The
							workspaces below are the last ones it reported.
						</Trans>
					</span>
					<Button
						size="sm"
						variant="outline"
						className="gap-1.5"
						onClick={() => setWakeOpen(true)}
					>
						<LuPower className="size-3.5" />
						<Trans>Wake</Trans>
					</Button>
				</div>
			)}

			{workspaces.length === 0 ? (
				<p className="py-6 text-center text-muted-foreground text-sm">
					<Trans>No workspace on this host yet.</Trans>
				</p>
			) : (
				<div className="flex flex-col gap-3">
					{withAgents.length === 0 && host.isOnline && (
						<p className="px-1.5 text-muted-foreground text-sm">
							<Trans>No agent is running on this host.</Trans>
						</p>
					)}
					{withAgents.map((group) => (
						<WorkspaceAgents
							key={group.workspace.id}
							workspace={group.workspace}
							agents={group.agents}
							agentConfigs={agentConfigs}
							actions={actions}
							canAct={canAct}
						/>
					))}
					{withoutAgents.length > 0 && (
						<div className="flex flex-col">
							<button
								type="button"
								onClick={() => setShowQuiet((value) => !value)}
								aria-expanded={showQuiet}
								className="flex h-7 items-center gap-1 px-1.5 text-left text-muted-foreground text-xs hover:text-foreground"
							>
								<LuChevronRight
									className={cn(
										"size-3 transition-transform",
										showQuiet && "rotate-90",
									)}
								/>
								{t({
									message: `Workspaces without agents (${quietCount})`,
								})}
							</button>
							{showQuiet &&
								withoutAgents.map((workspace) => (
									<WorkspaceAgents
										key={workspace.id}
										workspace={workspace}
										agents={[]}
										agentConfigs={agentConfigs}
										actions={actions}
										canAct={canAct}
									/>
								))}
						</div>
					)}
				</div>
			)}

			<WakeHostDialog
				open={wakeOpen}
				onOpenChange={setWakeOpen}
				machineId={host.machineId}
				hostName={host.name}
			/>
		</div>
	);
}
