import { beforeEach, describe, expect, test } from "bun:test";
import {
	DEFAULT_SIDEBAR_PREFERENCES,
	useSidebarPreferencesStore,
} from "./store";

describe("sidebar preferences", () => {
	beforeEach(() => {
		useSidebarPreferencesStore.setState(DEFAULT_SIDEBAR_PREFERENCES);
	});

	test("shows everything by default", () => {
		const state = useSidebarPreferencesStore.getState();
		expect(Object.values(DEFAULT_SIDEBAR_PREFERENCES).every(Boolean)).toBe(
			true,
		);
		expect(state.showConversations).toBe(true);
	});

	test("changes one preference and keeps the others", () => {
		useSidebarPreferencesStore.getState().setPreference("showTodos", false);
		const state = useSidebarPreferencesStore.getState();
		expect(state.showTodos).toBe(false);
		expect(state.showSubagents).toBe(true);
	});
});
