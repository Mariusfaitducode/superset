import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface WorkspaceLabelFilterState {
	/** Label names, so the filter spans hosts that each keep their own labels. */
	selected: string[];
	toggle: (name: string) => void;
	clear: () => void;
}

export const useWorkspaceLabelFilterStore = create<WorkspaceLabelFilterState>()(
	devtools(
		persist(
			(set) => ({
				selected: [],
				toggle: (name) =>
					set((state) => {
						const key = name.toLowerCase();
						return state.selected.some((item) => item.toLowerCase() === key)
							? {
									selected: state.selected.filter(
										(item) => item.toLowerCase() !== key,
									),
								}
							: { selected: [...state.selected, name] };
					}),
				clear: () => set({ selected: [] }),
			}),
			{
				name: "workspace-label-filter-v1",
				version: 1,
				partialize: ({ selected }) => ({ selected }),
			},
		),
		{ name: "WorkspaceLabelFilter" },
	),
);
