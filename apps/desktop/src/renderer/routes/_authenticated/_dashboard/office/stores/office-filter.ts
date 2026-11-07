import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OfficeFilterState {
	/** Hides the islands where nobody waits on you. */
	onlyNeedsMe: boolean;
	setOnlyNeedsMe: (value: boolean) => void;
}

export const useOfficeFilterStore = create<OfficeFilterState>()(
	persist(
		(set) => ({
			onlyNeedsMe: false,
			setOnlyNeedsMe: (onlyNeedsMe) => set({ onlyNeedsMe }),
		}),
		{ name: "office-filter" },
	),
);
