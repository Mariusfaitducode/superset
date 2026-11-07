import { create } from "zustand";

interface TaskMonitorState {
	isOpen: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
}

/** Whether the task monitor panel is out. Not kept across restarts. */
export const useTaskMonitorStore = create<TaskMonitorState>()((set) => ({
	isOpen: false,
	setOpen: (isOpen) => set({ isOpen }),
	toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
