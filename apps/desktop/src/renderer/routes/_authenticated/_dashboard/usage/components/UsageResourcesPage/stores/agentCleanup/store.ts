import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type AgentSortOption = "last-reply" | "memory" | "name";

export const CLEANUP_THRESHOLD_HOURS = [2, 6, 12, 24, 48, 168] as const;
export type CleanupThresholdHours = (typeof CLEANUP_THRESHOLD_HOURS)[number];

interface AgentCleanupState {
	/** Idle sessions unanswered for longer than this are offered for cleanup. */
	thresholdHours: CleanupThresholdHours;
	sortBy: AgentSortOption;
	setThresholdHours: (hours: CleanupThresholdHours) => void;
	setSortBy: (sortBy: AgentSortOption) => void;
}

/** Fixed-size singleton: the Resources page's cleanup rule and sort. */
export const useAgentCleanupStore = create<AgentCleanupState>()(
	devtools(
		persist(
			(set) => ({
				thresholdHours: 24,
				sortBy: "last-reply",
				setThresholdHours: (thresholdHours) => set({ thresholdHours }),
				setSortBy: (sortBy) => set({ sortBy }),
			}),
			{
				name: "agent-cleanup-v1",
				version: 1,
				partialize: ({ thresholdHours, sortBy }) => ({
					thresholdHours,
					sortBy,
				}),
			},
		),
		{ name: "AgentCleanup" },
	),
);
