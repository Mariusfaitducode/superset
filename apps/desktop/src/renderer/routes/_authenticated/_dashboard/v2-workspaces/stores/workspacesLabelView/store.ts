import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkspacesGroupBy = "status" | "label";

interface WorkspacesLabelViewState {
	/** Label names; a workspace must have every one. Empty = no filter. */
	labelFilters: string[];
	groupBy: WorkspacesGroupBy;
	toggleLabelFilter: (name: string) => void;
	clearLabelFilters: () => void;
	setGroupBy: (groupBy: WorkspacesGroupBy) => void;
}

/** The fork's label filter and board grouping for the workspaces page. */
export const useWorkspacesLabelViewStore = create<WorkspacesLabelViewState>()(
	persist(
		(set) => ({
			labelFilters: [],
			groupBy: "status",
			toggleLabelFilter: (name) =>
				set((state) => {
					const key = name.toLowerCase();
					return state.labelFilters.some((item) => item.toLowerCase() === key)
						? {
								labelFilters: state.labelFilters.filter(
									(item) => item.toLowerCase() !== key,
								),
							}
						: { labelFilters: [...state.labelFilters, name] };
				}),
			clearLabelFilters: () => set({ labelFilters: [] }),
			setGroupBy: (groupBy) => set({ groupBy }),
		}),
		{
			name: "workspaces-label-view-v1",
			version: 1,
			partialize: ({ labelFilters, groupBy }) => ({ labelFilters, groupBy }),
		},
	),
);
