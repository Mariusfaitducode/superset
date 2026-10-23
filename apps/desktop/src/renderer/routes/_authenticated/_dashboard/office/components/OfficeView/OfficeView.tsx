import { useMemo } from "react";
import {
	DashboardSidebarWorkspaceStatusProvider,
	type SidebarStatusWorkspaceRef,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { OfficeFloor } from "./components/OfficeFloor";

/**
 * The agents of every workspace as pixel-art people at their desks. It reads
 * the same agent bindings as the sidebar, through its own status provider.
 */
export function OfficeView() {
	const { workspaces } = useHostWorkspaces();
	const live = useMemo(
		() => workspaces.filter((workspace) => workspace.archivedAt == null),
		[workspaces],
	);
	const refs = useMemo<SidebarStatusWorkspaceRef[]>(
		() =>
			live.map((workspace) => ({ id: workspace.id, hostId: workspace.hostId })),
		[live],
	);
	return (
		<DashboardSidebarWorkspaceStatusProvider
			workspaces={refs}
			activeWorkspaceId={null}
		>
			<OfficeFloor workspaces={live} />
		</DashboardSidebarWorkspaceStatusProvider>
	);
}
