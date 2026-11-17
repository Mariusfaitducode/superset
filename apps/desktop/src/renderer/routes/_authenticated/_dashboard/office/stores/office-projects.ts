import { create } from "zustand";
import { persist } from "zustand/middleware";

// Picks for archived workspaces are never cleaned up one by one; the cap
// bounds them.
const MAX_PICKS = 300;

interface OfficeProjectsState {
	/** Workspace id → project id (or "other"), oldest first. */
	workspaceProjects: Record<string, string>;
	/** Null puts the workspace back under the rules. */
	setWorkspaceProject: (workspaceId: string, projectId: string | null) => void;
}

/** The project the user picked for a workspace, over the one guessed. */
export const useOfficeProjectsStore = create<OfficeProjectsState>()(
	persist(
		(set) => ({
			workspaceProjects: {},
			setWorkspaceProject: (workspaceId, projectId) =>
				set((state) => {
					const { [workspaceId]: _previous, ...rest } = state.workspaceProjects;
					if (projectId === null) return { workspaceProjects: rest };
					const entries = [...Object.entries(rest), [workspaceId, projectId]];
					return {
						workspaceProjects: Object.fromEntries(entries.slice(-MAX_PICKS)),
					};
				}),
		}),
		{
			name: "office-projects-v1",
			partialize: ({ workspaceProjects }) => ({ workspaceProjects }),
		},
	),
);
