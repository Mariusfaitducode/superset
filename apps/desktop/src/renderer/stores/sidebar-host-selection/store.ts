import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface SidebarHostSelectionState {
	/** The host whose rows the sidebar shows, by machine id; null shows every host. */
	machineId: string | null;
	select: (machineId: string | null) => void;
}

export const useSidebarHostSelectionStore = create<SidebarHostSelectionState>()(
	devtools(
		persist(
			(set) => ({
				machineId: null,
				select: (machineId) => set({ machineId }),
			}),
			{
				name: "sidebar-host-selection-v1",
				version: 1,
				partialize: ({ machineId }) => ({ machineId }),
			},
		),
		{ name: "SidebarHostSelection" },
	),
);
