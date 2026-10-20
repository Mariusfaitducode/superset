import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface SidebarPreferences {
	showConversations: boolean;
	showConversationStats: boolean;
	showTodos: boolean;
	showSubagents: boolean;
	showWaitingTint: boolean;
}

export type SidebarPreferenceKey = keyof SidebarPreferences;

export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = {
	showConversations: true,
	showConversationStats: true,
	showTodos: true,
	showSubagents: true,
	showWaitingTint: true,
};

interface SidebarPreferencesState extends SidebarPreferences {
	setPreference: (key: SidebarPreferenceKey, value: boolean) => void;
}

/** What the sidebar shows under each workspace. A fixed-size singleton. */
export const useSidebarPreferencesStore = create<SidebarPreferencesState>()(
	devtools(
		persist(
			(set) => ({
				...DEFAULT_SIDEBAR_PREFERENCES,
				setPreference: (key, value) => set({ [key]: value }),
			}),
			{
				name: "sidebar-preferences-v1",
				version: 1,
				partialize: ({ setPreference: _setPreference, ...preferences }) =>
					preferences,
			},
		),
		{ name: "SidebarPreferences" },
	),
);

export function useSidebarPreference(key: SidebarPreferenceKey): boolean {
	return useSidebarPreferencesStore((state) => state[key]);
}
