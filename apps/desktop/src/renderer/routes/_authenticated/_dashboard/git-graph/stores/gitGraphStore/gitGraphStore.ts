import { create } from "zustand";
import { persist } from "zustand/middleware";

// Bounds the persisted filters: a few repos, a few dozen refs each.
const MAX_PROJECTS = 20;
const MAX_REFS_PER_PROJECT = 50;

interface GitGraphState {
	projectId: string | null;
	/** Full ref names to show per project; empty shows every branch. */
	refsByProject: Record<string, string[]>;
	showRemotes: boolean;
	showTags: boolean;
	worktreesOnly: boolean;
	setProjectId: (projectId: string) => void;
	setRefs: (projectId: string, refs: string[]) => void;
	setShowRemotes: (showRemotes: boolean) => void;
	setShowTags: (showTags: boolean) => void;
	setWorktreesOnly: (worktreesOnly: boolean) => void;
}

type PersistedGitGraphState = Pick<
	GitGraphState,
	"projectId" | "refsByProject" | "showRemotes" | "showTags" | "worktreesOnly"
>;

export function migrateGitGraphState(
	persistedState: unknown,
): PersistedGitGraphState {
	const state =
		persistedState && typeof persistedState === "object"
			? (persistedState as Record<string, unknown>)
			: {};
	const refsByProject: Record<string, string[]> = {};
	if (state.refsByProject && typeof state.refsByProject === "object") {
		for (const [projectId, refs] of Object.entries(
			state.refsByProject as Record<string, unknown>,
		).slice(0, MAX_PROJECTS)) {
			if (!Array.isArray(refs)) continue;
			refsByProject[projectId] = refs
				.filter(
					(ref): ref is string =>
						typeof ref === "string" &&
						/^refs\/(heads|remotes|tags)\//.test(ref),
				)
				.slice(0, MAX_REFS_PER_PROJECT);
		}
	}
	return {
		projectId: typeof state.projectId === "string" ? state.projectId : null,
		refsByProject,
		showRemotes: state.showRemotes === true,
		showTags: state.showTags !== false,
		worktreesOnly: state.worktreesOnly === true,
	};
}

export const useGitGraphStore = create<GitGraphState>()(
	persist(
		(set) => ({
			projectId: null,
			refsByProject: {},
			showRemotes: false,
			showTags: true,
			worktreesOnly: false,
			setProjectId: (projectId) => set({ projectId }),
			setRefs: (projectId, refs) =>
				set((state) => {
					const others = Object.entries(state.refsByProject)
						.filter(([key]) => key !== projectId)
						.slice(0, MAX_PROJECTS - 1);
					return {
						refsByProject: Object.fromEntries([
							...(refs.length > 0
								? [[projectId, refs.slice(0, MAX_REFS_PER_PROJECT)]]
								: []),
							...others,
						]),
					};
				}),
			setShowRemotes: (showRemotes) => set({ showRemotes }),
			setShowTags: (showTags) => set({ showTags }),
			setWorktreesOnly: (worktreesOnly) => set({ worktreesOnly }),
		}),
		{
			name: "git-graph-state",
			version: 1,
			migrate: migrateGitGraphState,
			partialize: (state) => ({
				projectId: state.projectId,
				refsByProject: state.refsByProject,
				showRemotes: state.showRemotes,
				showTags: state.showTags,
				worktreesOnly: state.worktreesOnly,
			}),
		},
	),
);
