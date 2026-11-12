import { useLingui } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { LuGitBranch } from "react-icons/lu";
import { WorkspaceFocusToggle } from "renderer/components/WorkspaceFocus";
import type { HostAgentActions } from "renderer/routes/_authenticated/_dashboard/hosts/hooks/useHostAgentActions";
import type {
	HostAgentView,
	HostWorkspaceRef,
} from "renderer/routes/_authenticated/_dashboard/hosts/utils/groupHostAgents";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { AgentRow } from "./components/AgentRow";
import { NewAgentMenu } from "./components/NewAgentMenu";

interface WorkspaceAgentsProps {
	workspace: HostWorkspaceRef;
	agents: HostAgentView[];
	agentConfigs: ReadonlyArray<{ id: string; label: string }>;
	actions: HostAgentActions;
	/** False while the host is offline: rows show, actions can't reach it. */
	canAct: boolean;
}

/** A workspace of the host, its live agents and what can start in it. */
export function WorkspaceAgents({
	workspace,
	agents,
	agentConfigs,
	actions,
	canAct,
}: WorkspaceAgentsProps) {
	const { t } = useLingui();
	const navigate = useNavigate();
	return (
		<section className="flex flex-col">
			<div className="flex h-8 items-center gap-2 px-1.5">
				<WorkspaceFocusToggle workspaceId={workspace.id} />
				<button
					type="button"
					onClick={() => void navigateToV2Workspace(workspace.id, navigate)}
					className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline"
					title={t({ message: "Open the workspace" })}
				>
					<span className="truncate font-medium text-sm">{workspace.name}</span>
					{workspace.branch && workspace.branch !== workspace.name && (
						<span className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
							<LuGitBranch className="size-3 shrink-0" />
							<span className="truncate">{workspace.branch}</span>
						</span>
					)}
				</button>
				<NewAgentMenu
					agents={agentConfigs}
					disabled={!canAct}
					onStartAgent={(agentConfigId) =>
						void actions.startAgent(workspace.id, agentConfigId)
					}
					onOpenTerminal={() => void actions.openTerminal(workspace.id)}
				/>
			</div>
			{agents.length > 0 && (
				<div className="ml-3 flex flex-col border-border border-l pl-1">
					{agents.map((agent) => (
						<AgentRow
							key={agent.terminalId}
							agent={agent}
							disabled={!canAct}
							onOpen={() => actions.openAgent(workspace.id, agent.terminalId)}
							onStop={() => actions.stopAgent(workspace.id, agent.terminalId)}
						/>
					))}
				</div>
			)}
		</section>
	);
}
