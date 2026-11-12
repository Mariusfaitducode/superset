import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

/** Bound on the persisted ids: past it, the oldest focus is dropped. */
export const MAX_FOCUSED_WORKSPACES = 50;

interface WorkspaceFocusState {
	/**
	 * The workspaces the user is working on right now, oldest first. Ids of
	 * archived workspaces are pruned by `usePruneWorkspaceFocus`; deleted ones
	 * age out through the cap.
	 */
	ids: string[];
	/** Every view keeps only the focused workspaces while this is on. */
	focusOnly: boolean;
	toggle: (workspaceId: string) => void;
	setFocused: (workspaceIds: string[], focused: boolean) => void;
	setFocusOnly: (focusOnly: boolean) => void;
	/** Drops the given ids, e.g. workspaces that were archived. */
	forget: (workspaceIds: string[]) => void;
}

function withIds(ids: string[], added: string[]): string[] {
	const next = [...ids.filter((id) => !added.includes(id)), ...added];
	return next.slice(-MAX_FOCUSED_WORKSPACES);
}

export const useWorkspaceFocusStore = create<WorkspaceFocusState>()(
	devtools(
		persist(
			(set) => ({
				ids: [],
				focusOnly: false,
				toggle: (workspaceId) =>
					set((state) => ({
						ids: state.ids.includes(workspaceId)
							? state.ids.filter((id) => id !== workspaceId)
							: withIds(state.ids, [workspaceId]),
					})),
				setFocused: (workspaceIds, focused) =>
					set((state) => ({
						ids: focused
							? withIds(state.ids, workspaceIds)
							: state.ids.filter((id) => !workspaceIds.includes(id)),
					})),
				setFocusOnly: (focusOnly) => set({ focusOnly }),
				forget: (workspaceIds) =>
					set((state) =>
						workspaceIds.some((id) => state.ids.includes(id))
							? { ids: state.ids.filter((id) => !workspaceIds.includes(id)) }
							: state,
					),
			}),
			{
				name: "workspace-focus-v1",
				version: 1,
				partialize: ({ ids, focusOnly }) => ({ ids, focusOnly }),
			},
		),
		{ name: "WorkspaceFocus" },
	),
);
