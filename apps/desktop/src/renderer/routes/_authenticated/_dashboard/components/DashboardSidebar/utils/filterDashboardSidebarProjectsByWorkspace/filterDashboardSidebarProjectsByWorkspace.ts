import type {
	DashboardSidebarProject,
	DashboardSidebarProjectChild,
	DashboardSidebarWorkspace,
} from "../../types";

/**
 * Keeps the workspaces `keep` accepts, inside their projects and folders.
 * Projects and folders left with a match come back expanded so the matches
 * show; the persisted collapse state is never written. Inputs that change
 * nothing are returned as they were, for the memoized rows.
 */
export function filterDashboardSidebarProjectsByWorkspace(
	projects: DashboardSidebarProject[],
	keep: (workspace: DashboardSidebarWorkspace) => boolean,
): DashboardSidebarProject[] {
	return projects.flatMap((project): DashboardSidebarProject[] => {
		const children = project.children.flatMap(
			(child): DashboardSidebarProjectChild[] => {
				if (child.type === "workspace") {
					return keep(child.workspace) ? [child] : [];
				}
				const workspaces = child.section.workspaces.filter(keep);
				if (workspaces.length === 0) return [];
				return [
					{
						type: "section",
						section: { ...child.section, isCollapsed: false, workspaces },
					},
				];
			},
		);
		if (children.length === 0) return [];
		return [{ ...project, isCollapsed: false, children }];
	});
}
