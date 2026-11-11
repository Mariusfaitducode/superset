import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OfficeShow } from "../utils/officeStatus";

interface OfficeFilterState {
	show: OfficeShow;
	setShow: (show: OfficeShow) => void;
}

export const useOfficeFilterStore = create<OfficeFilterState>()(
	persist(
		(set) => ({
			show: "all",
			setShow: (show) => set({ show }),
		}),
		{
			name: "office-filter",
			version: 1,
			// v0 had an on/off `onlyNeedsMe`.
			migrate: (persisted, version) => {
				if (version === 0 && persisted && typeof persisted === "object") {
					const { onlyNeedsMe } = persisted as { onlyNeedsMe?: boolean };
					return { show: onlyNeedsMe ? "needsMe" : "all" } as OfficeFilterState;
				}
				return persisted as OfficeFilterState;
			},
			partialize: ({ show }) => ({ show }),
		},
	),
);
