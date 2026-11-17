import { useMemo } from "react";
import {
	DashboardSidebarWorkspaceStatusProvider,
	type SidebarStatusWorkspaceRef,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { useOfficeObserver } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeObserver";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { OfficeFloor } from "./components/OfficeFloor";

/**
 * The agents of every workspace as pixel-art people at their desks. It reads
 * the same agent bindings as the sidebar, through its own status provider.
 */
export function OfficeView() {
	const { workspaces } = useHostWorkspaces();
	const observer = useOfficeObserver();
	// The observer's own sessions sit in its booth, not at a desk.
	const live = useMemo(() => {
		const observerWorkspaces = new Set(
			observer.runs.map((run) => run.workspaceId),
		);
		return workspaces.filter(
			(workspace) =>
				workspace.archivedAt == null && !observerWorkspaces.has(workspace.id),
		);
	}, [workspaces, observer.runs]);
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
			<OfficeFloor workspaces={live} observer={observer} />
		</DashboardSidebarWorkspaceStatusProvider>
	);
}
