import { tagFolderScope } from "@superset/shared/workspace-tags";
import {
	getProjectFolderTagIndex,
	resolveWorkspaceFolder,
	type TagFolderSection,
} from "renderer/routes/_authenticated/utils/workspaceTagFolders/workspaceTagFolders";

/** The sidebar container an island stands for: a folder, else a project. */
export interface OfficeGroup {
	key: string;
	name: string;
	/** `#rrggbb`, or null for the default. */
	color: string | null;
}

export interface OfficeGroupWorkspace {
	id: string;
	name: string;
	projectId: string | null;
	tags?: readonly string[] | null;
}

export interface OfficeGroupProject {
	id: string;
	name: string;
	color: string | null;
}

/** Folder and project colors may be the "default" sentinel. */
function hexOrNull(color: string | null | undefined): string | null {
	return color?.startsWith("#") ? color : null;
}

/**
 * Places each workspace in the group the sidebar shows it under: its tag
 * folder (same resolver as the sidebar), else its project, else the
 * Sessions lane for project-less sessions. A folder without its own color takes its project's.
 */
export function assignOfficeGroups({
	workspaces,
	folders,
	projects,
	sessionsName,
}: {
	workspaces: readonly OfficeGroupWorkspace[];
	folders: readonly Pick<
		TagFolderSection,
		"sectionId" | "projectId" | "tabOrder" | "tag" | "name" | "color"
	>[];
	projects: readonly OfficeGroupProject[];
	sessionsName: string;
}): Map<string, OfficeGroup> {
	const projectsById = new Map(
		projects.map((project) => [project.id, project]),
	);
	const foldersById = new Map(
		folders.map((folder) => [folder.sectionId, folder]),
	);
	const indexByScope = new Map<
		string,
		ReturnType<typeof getProjectFolderTagIndex>
	>();
	const groups = new Map<string, OfficeGroup>();

	for (const workspace of workspaces) {
		const scope = tagFolderScope(workspace.projectId);
		let index = indexByScope.get(scope);
		if (!index) {
			index = getProjectFolderTagIndex(folders, scope);
			indexByScope.set(scope, index);
		}
		const project = workspace.projectId
			? projectsById.get(workspace.projectId)
			: undefined;
		const ref = resolveWorkspaceFolder(workspace.tags, index);
		const folder = ref ? foldersById.get(ref.sectionId) : undefined;
		if (folder) {
			groups.set(workspace.id, {
				key: `folder:${folder.sectionId}`,
				name: folder.name,
				color: hexOrNull(folder.color) ?? hexOrNull(project?.color),
			});
		} else if (project) {
			groups.set(workspace.id, {
				key: `project:${project.id}`,
				name: project.name,
				color: hexOrNull(project.color),
			});
		} else if (workspace.projectId === null) {
			groups.set(workspace.id, {
				key: "sessions",
				name: sessionsName,
				color: null,
			});
		} else {
			// Its project is not served yet: stand alone rather than guess.
			groups.set(workspace.id, {
				key: `workspace:${workspace.id}`,
				name: workspace.name,
				color: null,
			});
		}
	}
	return groups;
}
