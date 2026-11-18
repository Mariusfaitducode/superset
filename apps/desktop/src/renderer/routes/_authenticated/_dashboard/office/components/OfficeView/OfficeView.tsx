import { useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import {
	DashboardSidebarWorkspaceStatusProvider,
	type SidebarStatusWorkspaceRef,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { useOfficeObserver } from "renderer/routes/_authenticated/_dashboard/office/hooks/useOfficeObserver";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { OfficeFloor } from "./components/OfficeFloor";

/**
 * The agents of every workspace as pixel-art people at their desks. It reads
 * the same agent bindings as the sidebar, through its own status provider.
 */
export function OfficeView() {
	const { workspaces } = useHostWorkspaces();
	const observer = useOfficeObserver();
	const collections = useCollections();
	const { data: sidebarProjectRows = [] } = useLiveQuery(
		(q) =>
			q
				.from({ sidebarProjects: collections.v2SidebarProjects })
				.select(({ sidebarProjects }) => ({
					projectId: sidebarProjects.projectId,
					isHidden: sidebarProjects.isHidden,
				})),
		[collections],
	);
	// The observer's own sessions sit in its booth, not at a desk, and a
	// project hidden from the sidebar is hidden here too.
	const live = useMemo(() => {
		const observerWorkspaces = new Set(
			observer.runs.map((run) => run.workspaceId),
		);
		const hiddenProjects = new Set(
			sidebarProjectRows
				.filter((row) => row.isHidden)
				.map((row) => row.projectId),
		);
		return workspaces.filter(
			(workspace) =>
				workspace.archivedAt == null &&
				!observerWorkspaces.has(workspace.id) &&
				!(workspace.projectId && hiddenProjects.has(workspace.projectId)),
		);
	}, [workspaces, observer.runs, sidebarProjectRows]);
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
