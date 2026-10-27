import {
	MY_PULL_REQUEST_AGES,
	MY_PULL_REQUEST_ROLES,
	MY_PULL_REQUEST_STATES,
	type MyPullRequestAgeFilter,
	type MyPullRequestFilters,
	type MyPullRequestRole,
	type MyPullRequestStateFilter,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/filterMyPullRequests";
import {
	DEFAULT_PULL_REQUEST_PROJECTS,
	OTHER_PROJECT_ID,
	type PullRequestProject,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MyPullRequestGrouping = "action" | "project";

// Pins and moves of merged PRs are never cleaned up one by one; the caps
// bound them. Projects are typed by hand, a few dozen at most.
const MAX_OVERRIDES = 100;
const MAX_PROJECT_MOVES = 200;
const MAX_PROJECTS = 50;
const MAX_RULES = 50;

export type PullRequestProjectRules = Pick<
	PullRequestProject,
	"labels" | "keywords" | "pullRequests"
>;

interface MyPullRequestsState extends MyPullRequestFilters {
	/** Most recently pinned first. */
	pinned: string[];
	later: string[];
	groupBy: MyPullRequestGrouping;
	/** In the order the groups are shown. */
	projects: PullRequestProject[];
	/** PR key → project id (or OTHER_PROJECT_ID), oldest first. */
	projectMoves: Record<string, string>;
	setRepos: (repos: string[]) => void;
	toggleRole: (role: MyPullRequestRole) => void;
	toggleState: (state: MyPullRequestStateFilter) => void;
	setAge: (age: MyPullRequestAgeFilter) => void;
	clearFilters: () => void;
	togglePinned: (key: string) => void;
	toggleLater: (key: string) => void;
	setGroupBy: (groupBy: MyPullRequestGrouping) => void;
	addProject: (name: string) => void;
	renameProject: (id: string, name: string) => void;
	setProjectRules: (
		id: string,
		rules: Partial<PullRequestProjectRules>,
	) => void;
	moveProjectUp: (id: string) => void;
	deleteProject: (id: string) => void;
	/** null puts the PR back under its rules. */
	movePullRequestToProject: (key: string, projectId: string | null) => void;
}

type PersistedMyPullRequestsState = Pick<
	MyPullRequestsState,
	| "repos"
	| "roles"
	| "states"
	| "age"
	| "pinned"
	| "later"
	| "groupBy"
	| "projects"
	| "projectMoves"
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

function newProjectId(name: string, taken: PullRequestProject[]): string {
	const base =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "project";
	let id = base;
	for (
		let n = 2;
		id === OTHER_PROJECT_ID || taken.some((p) => p.id === id);
		n++
	)
		id = `${base}-${n}`;
	return id;
}

function migrateProjects(value: unknown): PullRequestProject[] {
	// Seed only a profile that never had projects; an emptied list stays empty.
	if (!Array.isArray(value)) return DEFAULT_PULL_REQUEST_PROJECTS;
	const projects: PullRequestProject[] = [];
	for (const item of value.slice(0, MAX_PROJECTS)) {
		if (!item || typeof item !== "object") continue;
		const raw = item as Record<string, unknown>;
		if (typeof raw.id !== "string" || typeof raw.name !== "string") continue;
		if (raw.id === OTHER_PROJECT_ID || projects.some((p) => p.id === raw.id))
			continue;
		projects.push({
			id: raw.id,
			name: raw.name,
			labels: stringList(raw.labels).slice(0, MAX_RULES),
			keywords: stringList(raw.keywords).slice(0, MAX_RULES),
			pullRequests: stringList(raw.pullRequests).slice(0, MAX_RULES),
		});
	}
	return projects;
}

function migrateProjectMoves(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	const entries = Object.entries(value).filter(
		(entry): entry is [string, string] => typeof entry[1] === "string",
	);
	return Object.fromEntries(entries.slice(-MAX_PROJECT_MOVES));
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
		projects: migrateProjects(state.projects),
		projectMoves: migrateProjectMoves(state.projectMoves),
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
			projects: DEFAULT_PULL_REQUEST_PROJECTS,
			projectMoves: {},
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
			addProject: (name) =>
				set((state) => {
					const trimmed = name.trim();
					if (!trimmed || state.projects.length >= MAX_PROJECTS) return {};
					const project: PullRequestProject = {
						id: newProjectId(trimmed, state.projects),
						name: trimmed,
						labels: [],
						keywords: [],
						pullRequests: [],
					};
					return { projects: [...state.projects, project] };
				}),
			renameProject: (id, name) =>
				set((state) => {
					const trimmed = name.trim();
					if (!trimmed) return {};
					return {
						projects: state.projects.map((project) =>
							project.id === id ? { ...project, name: trimmed } : project,
						),
					};
				}),
			setProjectRules: (id, rules) =>
				set((state) => ({
					projects: state.projects.map((project) =>
						project.id === id
							? {
									...project,
									...Object.fromEntries(
										Object.entries(rules).map(([field, list]) => [
											field,
											(list ?? []).slice(0, MAX_RULES),
										]),
									),
								}
							: project,
					),
				})),
			moveProjectUp: (id) =>
				set((state) => {
					const index = state.projects.findIndex((p) => p.id === id);
					if (index <= 0) return {};
					const projects = [...state.projects];
					const [project] = projects.splice(index, 1);
					if (project) projects.splice(index - 1, 0, project);
					return { projects };
				}),
			deleteProject: (id) =>
				set((state) => ({
					projects: state.projects.filter((project) => project.id !== id),
					projectMoves: Object.fromEntries(
						Object.entries(state.projectMoves).filter(
							([, projectId]) => projectId !== id,
						),
					),
				})),
			movePullRequestToProject: (key, projectId) =>
				set((state) => {
					const { [key]: _previous, ...rest } = state.projectMoves;
					if (projectId === null) return { projectMoves: rest };
					const entries = [...Object.entries(rest), [key, projectId]];
					return {
						projectMoves: Object.fromEntries(entries.slice(-MAX_PROJECT_MOVES)),
					};
				}),
		}),
		{
			name: "my-pull-requests-state",
			version: 3,
			migrate: migrateMyPullRequestsState,
			partialize: (state) => ({
				repos: state.repos,
				roles: state.roles,
				states: state.states,
				age: state.age,
				pinned: state.pinned,
				later: state.later,
				groupBy: state.groupBy,
				projects: state.projects,
				projectMoves: state.projectMoves,
			}),
		},
	),
);
