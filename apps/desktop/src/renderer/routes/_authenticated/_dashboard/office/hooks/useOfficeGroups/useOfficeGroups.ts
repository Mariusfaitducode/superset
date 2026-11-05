import { useLingui } from "@lingui/react/macro";
import { useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import { useHostProjects } from "renderer/hooks/host-projects/useHostProjects";
import {
	assignOfficeGroups,
	type OfficeGroup,
	type OfficeGroupWorkspace,
} from "renderer/routes/_authenticated/_dashboard/office/utils/officeGroups";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import {
	deriveTagFolders,
	useTagFolderContext,
} from "renderer/routes/_authenticated/utils/workspaceTagFolders";

/** Each workspace's sidebar folder or project, with its name and color. */
export function useOfficeGroups(
	workspaces: readonly OfficeGroupWorkspace[],
): Map<string, OfficeGroup> {
	const { t } = useLingui();
	const collections = useCollections();
	const { workspaces: hostWorkspaces } = useHostWorkspaces();
	const tagFolderContext = useTagFolderContext();
	const { projects } = useHostProjects();
	const { data: storedSections = [] } = useLiveQuery(
		(q) =>
			q
				.from({ sidebarSections: collections.v2SidebarSections })
				.select(({ sidebarSections }) => ({
					sectionId: sidebarSections.sectionId,
					projectId: sidebarSections.projectId,
					name: sidebarSections.name,
					createdAt: sidebarSections.createdAt,
					isCollapsed: sidebarSections.isCollapsed,
					tabOrder: sidebarSections.tabOrder,
					color: sidebarSections.color,
					tag: sidebarSections.tag,
				})),
		[collections],
	);
	const sessionsName = t`Sessions`;

	return useMemo(
		() =>
			assignOfficeGroups({
				workspaces,
				folders: deriveTagFolders(
					storedSections,
					hostWorkspaces,
					tagFolderContext,
				),
				projects: projects.map((project) => ({
					id: project.projectKey,
					name: project.name,
					color: project.color,
				})),
				sessionsName,
			}),
		[
			workspaces,
			storedSections,
			hostWorkspaces,
			tagFolderContext,
			projects,
			sessionsName,
		],
	);
}
