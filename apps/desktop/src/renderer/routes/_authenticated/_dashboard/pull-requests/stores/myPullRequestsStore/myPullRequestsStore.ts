import {
	MY_PULL_REQUEST_AGES,
	MY_PULL_REQUEST_ROLES,
	MY_PULL_REQUEST_STATES,
	type MyPullRequestAgeFilter,
	type MyPullRequestFilters,
	type MyPullRequestRole,
	type MyPullRequestStateFilter,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/filterMyPullRequests";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MyPullRequestGrouping = "action" | "project";

// Pins of merged PRs are never cleaned up one by one; the cap bounds them.
const MAX_OVERRIDES = 100;

interface MyPullRequestsState extends MyPullRequestFilters {
	/** Most recently pinned first. */
	pinned: string[];
	later: string[];
	groupBy: MyPullRequestGrouping;
	setRepos: (repos: string[]) => void;
	toggleRole: (role: MyPullRequestRole) => void;
	toggleState: (state: MyPullRequestStateFilter) => void;
	setAge: (age: MyPullRequestAgeFilter) => void;
	clearFilters: () => void;
	togglePinned: (key: string) => void;
	toggleLater: (key: string) => void;
	setGroupBy: (groupBy: MyPullRequestGrouping) => void;
}

type PersistedMyPullRequestsState = Pick<
	MyPullRequestsState,
	"repos" | "roles" | "states" | "age" | "pinned" | "later" | "groupBy"
>;

function toggle<T>(list: T[], value: T): T[] {
	return list.includes(value)
		? list.filter((item) => item !== value)
		: [...list, value];
}

function stringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

export function migrateMyPullRequestsState(
	persistedState: unknown,
): PersistedMyPullRequestsState {
	const state =
		persistedState && typeof persistedState === "object"
			? (persistedState as Record<string, unknown>)
			: {};
	const pick = <T extends string>(allowed: T[], value: unknown): T[] =>
		stringList(value).filter((item): item is T => allowed.includes(item as T));
	return {
		repos: stringList(state.repos),
		roles: pick(MY_PULL_REQUEST_ROLES, state.roles),
		states: pick(MY_PULL_REQUEST_STATES, state.states),
		age: MY_PULL_REQUEST_AGES.includes(state.age as MyPullRequestAgeFilter)
			? (state.age as MyPullRequestAgeFilter)
			: "any",
		pinned: stringList(state.pinned).slice(0, MAX_OVERRIDES),
		later: stringList(state.later).slice(0, MAX_OVERRIDES),
		groupBy: state.groupBy === "project" ? "project" : "action",
	};
}

export const useMyPullRequestsStore = create<MyPullRequestsState>()(
	persist(
		(set) => ({
			repos: [],
			roles: [],
			states: [],
			age: "any",
			pinned: [],
			later: [],
			groupBy: "action",
			setRepos: (repos) => set({ repos }),
			toggleRole: (role) =>
				set((state) => ({ roles: toggle(state.roles, role) })),
			toggleState: (value) =>
				set((state) => ({ states: toggle(state.states, value) })),
			setAge: (age) => set({ age }),
			clearFilters: () => set({ repos: [], roles: [], states: [], age: "any" }),
			togglePinned: (key) =>
				set((state) => ({
					pinned: state.pinned.includes(key)
						? state.pinned.filter((item) => item !== key)
						: [key, ...state.pinned].slice(0, MAX_OVERRIDES),
					later: state.later.filter((item) => item !== key),
				})),
			toggleLater: (key) =>
				set((state) => ({
					later: state.later.includes(key)
						? state.later.filter((item) => item !== key)
						: [key, ...state.later].slice(0, MAX_OVERRIDES),
					pinned: state.pinned.filter((item) => item !== key),
				})),
			setGroupBy: (groupBy) => set({ groupBy }),
		}),
		{
			name: "my-pull-requests-state",
			version: 2,
			migrate: migrateMyPullRequestsState,
			partialize: (state) => ({
				repos: state.repos,
				roles: state.roles,
				states: state.states,
				age: state.age,
				pinned: state.pinned,
				later: state.later,
				groupBy: state.groupBy,
			}),
		},
	),
);
