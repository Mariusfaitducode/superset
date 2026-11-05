import { useMemo } from "react";
import { useV2NotificationStore } from "renderer/stores/v2-notifications";
import { useSidebarWorkspaceStatus } from "../../providers/DashboardSidebarWorkspaceStatusProvider";
import type { DashboardSidebarWorkspace } from "../../types";
import {
	deriveWorkspaceAgentState,
	type WorkspaceAgentState,
} from "./workspaceAgentState";

export function useWorkspaceAgentState(
	workspaceId: string,
	sandboxStatus: DashboardSidebarWorkspace["sandboxStatus"] = null,
): WorkspaceAgentState {
	const { status, bindings } = useSidebarWorkspaceStatus(workspaceId);
	const terminalSeenAt = useV2NotificationStore(
		(state) => state.terminalSeenAt,
	);
	return useMemo(
		() =>
			deriveWorkspaceAgentState({
				status,
				sandboxStatus,
				bindings: bindings.values(),
				terminalSeenAt,
			}),
		[status, sandboxStatus, bindings, terminalSeenAt],
	);
}
