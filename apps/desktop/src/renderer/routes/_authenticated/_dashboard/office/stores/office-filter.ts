import { WORK_STATES, type WorkState } from "renderer/lib/agent-state";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Rooms are the sidebar's folders, or the user's projects. */
export type OfficeRooms = "folders" | "projects";

interface PersistedOfficeFilter {
	states: WorkState[];
	projects: string[];
	projectStatuses: string[];
	rooms: OfficeRooms;
}

interface OfficeFilterState extends PersistedOfficeFilter {
	toggleState: (state: WorkState) => void;
	/** Shows only this state, or every state when it is the only one shown. */
	soloState: (state: WorkState) => void;
	toggleProject: (projectId: string) => void;
	toggleProjectStatus: (status: string) => void;
	setRooms: (rooms: OfficeRooms) => void;
	clear: () => void;
}

function toggle<T>(list: readonly T[], value: T): T[] {
	return list.includes(value)
		? list.filter((item) => item !== value)
		: [...list, value];
}

function strings(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

/**
 * v0 had an on/off `onlyNeedsMe`, v1 called "working" "active", v2 had one
 * `show` choice (everyone, working, needs me); v3 filters by work state.
 */
export function migrateOfficeFilter(
	persisted: unknown,
	version: number,
): PersistedOfficeFilter {
	const stored = (persisted ?? {}) as Record<string, unknown>;
	const empty: PersistedOfficeFilter = {
		states: [],
		projects: [],
		projectStatuses: [],
		rooms: "folders",
	};
	if (version < 3) {
		const show =
			version === 0
				? stored.onlyNeedsMe
					? "needsMe"
					: "all"
				: stored.show === "active"
					? "working"
					: stored.show;
		if (show === "needsMe") return { ...empty, states: ["waiting"] };
		if (show === "working") return { ...empty, states: ["working"] };
		return empty;
	}
	return {
		states: strings(stored.states).filter((state): state is WorkState =>
			WORK_STATES.includes(state as WorkState),
		),
		projects: strings(stored.projects),
		projectStatuses: strings(stored.projectStatuses),
		rooms: stored.rooms === "projects" ? "projects" : "folders",
	};
}

export const useOfficeFilterStore = create<OfficeFilterState>()(
	persist(
		(set) => ({
			states: [],
			projects: [],
			projectStatuses: [],
			rooms: "folders",
			toggleState: (state) =>
				set((current) => ({ states: toggle(current.states, state) })),
			soloState: (state) =>
				set((current) => ({
					states:
						current.states.length === 1 && current.states[0] === state
							? []
							: [state],
				})),
			toggleProject: (projectId) =>
				set((current) => ({ projects: toggle(current.projects, projectId) })),
			toggleProjectStatus: (status) =>
				set((current) => ({
					projectStatuses: toggle(current.projectStatuses, status),
				})),
			setRooms: (rooms) => set({ rooms }),
			clear: () => set({ states: [], projects: [], projectStatuses: [] }),
		}),
		{
			name: "office-filter",
			version: 3,
			migrate: (persisted, version) =>
				migrateOfficeFilter(persisted, version) as OfficeFilterState,
			partialize: ({ states, projects, projectStatuses, rooms }) => ({
				states,
				projects,
				projectStatuses,
				rooms,
			}),
		},
	),
);
