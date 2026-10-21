import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const MAX_REMEMBERED = 100;

interface WorkspaceRecencyState {
	/** Workspace ids, most recently opened first. */
	recent: string[];
	touch: (workspaceId: string) => void;
}

export const useWorkspaceRecencyStore = create<WorkspaceRecencyState>()(
	devtools(
		persist(
			(set) => ({
				recent: [],
				touch: (workspaceId) =>
					set((state) =>
						state.recent[0] === workspaceId
							? state
							: {
									recent: [
										workspaceId,
										...state.recent.filter((id) => id !== workspaceId),
									].slice(0, MAX_REMEMBERED),
								},
					),
			}),
			{
				name: "workspace-recency-v1",
				version: 1,
				partialize: ({ recent }) => ({ recent }),
			},
		),
		{ name: "WorkspaceRecency" },
	),
);

/**
 * `items` reordered most recently opened first. Items never opened keep
 * their given order, after the rest.
 */
export function orderByRecency<Item extends { id: string }>(
	items: readonly Item[],
	recent: readonly string[],
): Item[] {
	const rank = new Map(recent.map((id, index) => [id, index]));
	return items
		.map((item, index) => ({ item, index }))
		.sort(
			(a, b) =>
				(rank.get(a.item.id) ?? recent.length + a.index) -
				(rank.get(b.item.id) ?? recent.length + b.index),
		)
		.map(({ item }) => item);
}
