import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OfficeShow } from "../utils/officeStatus";

interface OfficeFilterState {
	show: OfficeShow;
	setShow: (show: OfficeShow) => void;
}

/** v0 had an on/off `onlyNeedsMe`; v1 called "working" "active". */
export function migrateOfficeFilter(
	persisted: unknown,
	version: number,
): { show: OfficeShow } {
	const stored = (persisted ?? {}) as { onlyNeedsMe?: boolean; show?: string };
	if (version === 0) return { show: stored.onlyNeedsMe ? "needsMe" : "all" };
	if (stored.show === "active") return { show: "working" };
	return {
		show:
			stored.show === "working" || stored.show === "needsMe"
				? stored.show
				: "all",
	};
}

export const useOfficeFilterStore = create<OfficeFilterState>()(
	persist(
		(set) => ({
			show: "all",
			setShow: (show) => set({ show }),
		}),
		{
			name: "office-filter",
			version: 2,
			migrate: (persisted, version) =>
				migrateOfficeFilter(persisted, version) as OfficeFilterState,
			partialize: ({ show }) => ({ show }),
		},
	),
);
