import { WaveSpinner } from "@superset/ui/atoms/WaveSpinner";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { AgentStateDot } from "renderer/components/AgentStateDot";
import type { AgentState } from "renderer/lib/agent-state";
import type {
	DashboardSidebarWorkspace,
	DashboardSidebarWorkspacePullRequest,
} from "../../../../../../types";
import {
	PR_COLOR_BY_STATE,
	PR_ICON_BY_STATE,
} from "../../../DashboardSidebarWorkspaceIcon";

interface DashboardSidebarWorkspaceLeadIndicatorProps {
	/** The most urgent state of the workspace's conversations. */
	agentState: AgentState;
	isCreatePending: boolean;
	sandboxStatus?: DashboardSidebarWorkspace["sandboxStatus"];
	/** Drawn when nothing is going on; null when the PR has its own spot. */
	pullRequestState: DashboardSidebarWorkspacePullRequest["state"] | null;
}

type LeadKind = AgentState | "creating" | "pull-request";

/**
 * One glyph: the sandbox's own state (nothing runs in a dead or unborn box),
 * then the agent state, then the PR when the row has nowhere else to show it.
 */
function pickLead({
	agentState,
	isCreatePending,
	sandboxStatus,
	pullRequestState,
}: Required<DashboardSidebarWorkspaceLeadIndicatorProps>): {
	leadKind: LeadKind;
	lead: ReactNode;
} {
	if (sandboxStatus === "failed") {
		return { leadKind: "failed", lead: <AgentStateDot state="failed" /> };
	}
	if (isCreatePending || sandboxStatus === "provisioning") {
		return {
			leadKind: "creating",
			lead: <WaveSpinner className="text-muted-foreground/60" />,
		};
	}
	if (agentState === "working") {
		return {
			leadKind: "working",
			lead: <WaveSpinner className="text-[color:var(--sb-state-working)]" />,
		};
	}
	if (agentState !== "idle") {
		return { leadKind: agentState, lead: <AgentStateDot state={agentState} /> };
	}
	if (pullRequestState) {
		const PrIcon = PR_ICON_BY_STATE[pullRequestState];
		return {
			leadKind: "pull-request",
			lead: (
				<PrIcon
					className={cn("size-3", PR_COLOR_BY_STATE[pullRequestState])}
					strokeWidth={2}
				/>
			),
		};
	}
	return { leadKind: "idle", lead: <AgentStateDot state="idle" /> };
}

export function DashboardSidebarWorkspaceLeadIndicator({
	agentState,
	isCreatePending,
	sandboxStatus = null,
	pullRequestState,
}: DashboardSidebarWorkspaceLeadIndicatorProps) {
	const { leadKind, lead } = pickLead({
		agentState,
		isCreatePending,
		sandboxStatus,
		pullRequestState,
	});
	return (
		<span className="contents" data-lead={leadKind}>
			{lead}
		</span>
	);
}
