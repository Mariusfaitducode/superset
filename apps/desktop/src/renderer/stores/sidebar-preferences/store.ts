import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type WaitingTint = "off" | "subtle" | "strong";

export interface SidebarPreferences {
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
};

interface SidebarPreferencesState extends SidebarPreferences {
	setPreference: (key: SidebarPreferenceKey, value: boolean) => void;
	setWaitingTint: (waitingTint: WaitingTint) => void;
	reset: () => void;
}

/** What the sidebar shows under each workspace. A fixed-size singleton. */
export const useSidebarPreferencesStore = create<SidebarPreferencesState>()(
	devtools(
		persist(
			(set) => ({
				...DEFAULT_SIDEBAR_PREFERENCES,
				setPreference: (key, value) => set({ [key]: value }),
				setWaitingTint: (waitingTint) => set({ waitingTint }),
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
