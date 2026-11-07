import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { SidebarAppearance, StateColorKey } from "./appearance";
import type { SidebarNavItemId } from "./nav-items";

export type WaitingTint = "off" | "subtle" | "strong";

export interface SidebarPreferences extends SidebarAppearance {
	showConversations: boolean;
	/** Conversations whose agent has not started a turn yet. */
	showIdleConversations: boolean;
	showConversationStats: boolean;
	showTurnTime: boolean;
	showTodos: boolean;
	/** To-dos the agents added themselves, not only the user's. */
	showAgentTodos: boolean;
	showSubagents: boolean;
	showQueuedPrompts: boolean;
	waitingTint: WaitingTint;
	/** Menu entries at the top of the sidebar that the user took out. */
	hiddenNavItems: SidebarNavItemId[];
	/** Keep the sidebar on the left of the Settings pages. */
	keepSidebarInSettings: boolean;
	/** Pages as one wrapped row of icons rather than a row each. */
	navItemsAsIcons: boolean;
	/** One line per workspace, as before, instead of a details line under it. */
	singleLineRows: boolean;
	/** What the details line under a workspace shows. */
	showRowBranch: boolean;
	showRowPullRequest: boolean;
	showRowTodos: boolean;
	showRowWaitTime: boolean;
	/** A conversation's to-dos open under it, rather than in a popover. */
	todosInline: boolean;
}

export type SidebarPreferenceKey = {
	[Key in keyof SidebarPreferences]: SidebarPreferences[Key] extends boolean
		? Key
		: never;
}[keyof SidebarPreferences];

export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = {
	showConversations: true,
	showIdleConversations: true,
	showConversationStats: true,
	showTurnTime: true,
	showTodos: true,
	showAgentTodos: true,
	showSubagents: true,
	showQueuedPrompts: true,
	waitingTint: "subtle",
	density: "normal",
	contrast: "normal",
	activeMarker: "outline",
	markerIntensity: "normal",
	bandWidth: 3,
	statePalette: "default",
	stateColors: {},
	folderColorOnConversations: false,
	hiddenNavItems: [],
	keepSidebarInSettings: true,
	navItemsAsIcons: true,
	singleLineRows: false,
	showRowBranch: true,
	showRowPullRequest: true,
	showRowTodos: true,
	showRowWaitTime: true,
	todosInline: false,
};

type AppearanceKey = Exclude<keyof SidebarAppearance, "stateColors">;

interface SidebarPreferencesState extends SidebarPreferences {
	setPreference: (key: SidebarPreferenceKey, value: boolean) => void;
	setWaitingTint: (waitingTint: WaitingTint) => void;
	setAppearance: <Key extends AppearanceKey>(
		key: Key,
		value: SidebarAppearance[Key],
	) => void;
	setNavItemVisible: (item: SidebarNavItemId, visible: boolean) => void;
	/** Null goes back to the palette's color. */
	setStateColor: (key: StateColorKey, color: string | null) => void;
	reset: () => void;
}

/** What the sidebar shows under each workspace, and how. A fixed-size singleton. */
export const useSidebarPreferencesStore = create<SidebarPreferencesState>()(
	devtools(
		persist(
			(set) => ({
				...DEFAULT_SIDEBAR_PREFERENCES,
				setPreference: (key, value) => set({ [key]: value }),
				setWaitingTint: (waitingTint) => set({ waitingTint }),
				setAppearance: (key, value) => set({ [key]: value }),
				setNavItemVisible: (item, visible) =>
					set((state) => ({
						hiddenNavItems: visible
							? state.hiddenNavItems.filter((hidden) => hidden !== item)
							: [...new Set([...state.hiddenNavItems, item])],
					})),
				setStateColor: (key, color) =>
					set((state) => {
						const { [key]: _previous, ...rest } = state.stateColors;
						return {
							stateColors: color === null ? rest : { ...rest, [key]: color },
						};
					}),
				reset: () => set(DEFAULT_SIDEBAR_PREFERENCES),
			}),
			{
				name: "sidebar-preferences-v1",
				version: 3,
				migrate: (persisted, version) =>
					migrateSidebarPreferences(
						persisted,
						version,
					) as unknown as SidebarPreferencesState,
				partialize: ({
					setPreference: _setPreference,
					setWaitingTint: _setWaitingTint,
					setAppearance: _setAppearance,
					setStateColor: _setStateColor,
					setNavItemVisible: _setNavItemVisible,
					reset: _reset,
					...preferences
				}) => preferences,
			},
		),
		{ name: "SidebarPreferences" },
	),
);

/**
 * v1 had an on/off `showWaitingTint`. v2 had six state colors; v3 has the
 * five agent states, so a hand-picked "request" color becomes "needs you".
 */
export function migrateSidebarPreferences(
	persisted: unknown,
	version: number,
): SidebarPreferences {
	if (!persisted || typeof persisted !== "object") {
		return DEFAULT_SIDEBAR_PREFERENCES;
	}
	let state = { ...(persisted as Record<string, unknown>) };
	if (version < 2) {
		const { showWaitingTint, ...rest } = state;
		state = {
			...rest,
			waitingTint: showWaitingTint === false ? "off" : "subtle",
		};
	}
	if (version < 3) {
		const {
			request,
			seen: _seen,
			...colors
		} = (state.stateColors ?? {}) as Record<string, string>;
		state.stateColors = request ? { ...colors, needsYou: request } : colors;
	}
	return { ...DEFAULT_SIDEBAR_PREFERENCES, ...state } as SidebarPreferences;
}

export function useSidebarPreference<Key extends keyof SidebarPreferences>(
	key: Key,
): SidebarPreferences[Key] {
	return useSidebarPreferencesStore((state) => state[key]);
}
