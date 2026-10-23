import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// Bounds the persisted list: deleted workspaces never close their panel.
export const MAX_OPEN_PANELS = 50;

interface WorkspaceNotesPanelState {
	openWorkspaceIds: string[];
	/** Shows dropped and done notes too. */
	showAll: boolean;
	toggle: (workspaceId: string) => void;
	setShowAll: (showAll: boolean) => void;
}

export const useWorkspaceNotesPanelStore = create<WorkspaceNotesPanelState>()(
	devtools(
		persist(
			(set) => ({
				openWorkspaceIds: [],
				showAll: false,
				toggle: (workspaceId) =>
					set((state) => ({
						openWorkspaceIds: state.openWorkspaceIds.includes(workspaceId)
							? state.openWorkspaceIds.filter((id) => id !== workspaceId)
							: [...state.openWorkspaceIds, workspaceId].slice(
									-MAX_OPEN_PANELS,
								),
					})),
				setShowAll: (showAll) => set({ showAll }),
			}),
			{
				name: "workspace-notes-panel-v1",
				version: 1,
				partialize: ({ openWorkspaceIds, showAll }) => ({
					openWorkspaceIds,
					showAll,
				}),
			},
		),
		{ name: "WorkspaceNotesPanel" },
	),
);

export function useIsWorkspaceNotesOpen(workspaceId: string): boolean {
	return useWorkspaceNotesPanelStore((state) =>
		state.openWorkspaceIds.includes(workspaceId),
	);
}
