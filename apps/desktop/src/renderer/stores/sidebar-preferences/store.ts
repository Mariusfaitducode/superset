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
				version: 2,
				// v1 had an on/off `showWaitingTint`.
				migrate: (persisted, version) => {
					if (version === 1 && persisted && typeof persisted === "object") {
						const { showWaitingTint, ...rest } = persisted as {
							showWaitingTint?: boolean;
						};
						return {
							...DEFAULT_SIDEBAR_PREFERENCES,
							...rest,
							waitingTint: showWaitingTint === false ? "off" : "subtle",
						} as SidebarPreferencesState;
					}
					return persisted as SidebarPreferencesState;
				},
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

export function useSidebarPreference<Key extends keyof SidebarPreferences>(
	key: Key,
): SidebarPreferences[Key] {
	return useSidebarPreferencesStore((state) => state[key]);
}
