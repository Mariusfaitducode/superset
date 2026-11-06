import { PROJECT_COLOR_DEFAULT } from "shared/constants/project-colors";
import {
	type WorkspaceLabel,
	type WorkspaceLabelsState,
	workspaceLabels,
} from "../../components/WorkspaceLabels/labels";
import type {
	DashboardSidebarPinnedWorkspace,
	DashboardSidebarProject,
	DashboardSidebarProjectChild,
	DashboardSidebarSection,
	DashboardSidebarWorkspace,
	DashboardSidebarWorkspacePullRequest,
} from "../../types";

/** A project or sidebar folder: what the switcher shows a workspace under. */
export interface WorkspaceSwitcherGroup {
	name: string;
	/** `#rrggbb`, or null for the default. */
	color: string | null;
}

export interface WorkspaceSwitcherTodos {
	open: number;
	highPriority: number;
}

export interface ActiveWorkspaceSwitcherOption {
	id: string;
	name: string;
	/** The project name, as a one-line hint; null outside projects. */
	detail: string | null;
	project: WorkspaceSwitcherGroup | null;
	/** The sidebar folder holding the workspace, if any. */
	section: WorkspaceSwitcherGroup | null;
	labels: WorkspaceLabel[];
	branch: string | null;
	pullRequest: Pick<
		DashboardSidebarWorkspacePullRequest,
		"number" | "state"
	> | null;
	todos: WorkspaceSwitcherTodos;
}

/** The fields of a host to-do the switcher counts. */
export interface SwitcherTodo {
	workspaceId: string;
	done: boolean;
	priority: string;
}

const NO_TODOS: WorkspaceSwitcherTodos = {
	open: 0,
	highPriority: 0,
};

function groupColor(color: string | null): string | null {
	return color && color !== PROJECT_COLOR_DEFAULT ? color : null;
}

function toGroup(source: {
	name: string;
	color: string | null;
}): WorkspaceSwitcherGroup {
	return { name: source.name, color: groupColor(source.color) };
}

function countTodos(
	todos: Iterable<SwitcherTodo>,
): Map<string, WorkspaceSwitcherTodos> {
	const byWorkspace = new Map<string, WorkspaceSwitcherTodos>();
	for (const todo of todos) {
		if (todo.done) continue;
		let entry = byWorkspace.get(todo.workspaceId);
		if (!entry) {
			entry = { open: 0, highPriority: 0 };
			byWorkspace.set(todo.workspaceId, entry);
		}
		entry.open += 1;
		if (todo.priority === "high") entry.highPriority += 1;
	}
	return byWorkspace;
}

/**
 * One option per workspace the sidebar lists, for the workspace switchers:
 * where it sits (project and folder, with their colors), its labels, branch,
 * pull request and open to-dos. Everything comes from data the sidebar has
 * already loaded. A workspace listed twice keeps its project-row entry, then
 * a cloud entry, over a pinned or session one.
 */
export function buildWorkspaceSwitcherOptions({
	pinnedWorkspaces,
	sessionChildren,
	projects,
	cloudWorkspaces,
	labelsByHost,
	todos,
}: {
	pinnedWorkspaces: DashboardSidebarPinnedWorkspace[];
	sessionChildren: DashboardSidebarProjectChild[];
	projects: DashboardSidebarProject[];
	cloudWorkspaces: { id: string; name: string }[];
	labelsByHost: ReadonlyMap<string, WorkspaceLabelsState>;
	todos: Iterable<SwitcherTodo>;
}): ActiveWorkspaceSwitcherOption[] {
	const todosByWorkspace = countTodos(todos);
	const projectsById = new Map(
		projects.map((project) => [project.id, project]),
	);
	const byId = new Map<string, ActiveWorkspaceSwitcherOption>();

	const add = (
		workspace: DashboardSidebarWorkspace,
		project: WorkspaceSwitcherGroup | null,
		section: DashboardSidebarSection | null,
	) => {
		byId.set(workspace.id, {
			id: workspace.id,
			name: workspace.name,
			detail: project?.name ?? null,
			project,
			section: section ? toGroup(section) : null,
			labels: workspaceLabels(labelsByHost.get(workspace.hostId), workspace.id),
			branch: workspace.branch || null,
			pullRequest: workspace.pullRequest
				? {
						number: workspace.pullRequest.number,
						state: workspace.pullRequest.state,
					}
				: null,
			todos: todosByWorkspace.get(workspace.id) ?? NO_TODOS,
		});
	};
	const addChildren = (
		children: DashboardSidebarProjectChild[],
		project: WorkspaceSwitcherGroup | null,
	) => {
		for (const child of children) {
			if (child.type === "workspace") {
				add(child.workspace, project, null);
				continue;
			}
			for (const workspace of child.section.workspaces) {
				add(workspace, project, child.section);
			}
		}
	};

	for (const workspace of pinnedWorkspaces) {
		const project = workspace.projectId
			? projectsById.get(workspace.projectId)
			: undefined;
		add(
			workspace,
			project
				? toGroup(project)
				: workspace.projectName
					? { name: workspace.projectName, color: null }
					: null,
			null,
		);
	}
	addChildren(sessionChildren, null);
	for (const project of projects) {
		addChildren(project.children, toGroup(project));
	}
	for (const cloud of cloudWorkspaces) {
		byId.set(cloud.id, {
			id: cloud.id,
			name: cloud.name,
			detail: null,
			project: null,
			section: null,
			labels: [],
			branch: null,
			pullRequest: null,
			todos: todosByWorkspace.get(cloud.id) ?? NO_TODOS,
		});
	}
	return [...byId.values()];
}
