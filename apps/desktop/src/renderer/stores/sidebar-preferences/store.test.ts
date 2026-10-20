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
		expect(
			Object.values(DEFAULT_SIDEBAR_PREFERENCES)
				.filter((value) => typeof value === "boolean")
				.every(Boolean),
		).toBe(true);
		expect(state.showConversations).toBe(true);
	});

	test("changes one preference and keeps the others", () => {
		useSidebarPreferencesStore.getState().setPreference("showTodos", false);
		const state = useSidebarPreferencesStore.getState();
		expect(state.showTodos).toBe(false);
		expect(state.showSubagents).toBe(true);
	});

	test("resets to the defaults", () => {
		const store = useSidebarPreferencesStore.getState();
		store.setPreference("showTodos", false);
		store.setWaitingTint("strong");
		useSidebarPreferencesStore.getState().reset();
		const state = useSidebarPreferencesStore.getState();
		expect(state.showTodos).toBe(true);
		expect(state.waitingTint).toBe("subtle");
	});

	test("turns v1's tint switch into a tint level", async () => {
		const migrate = useSidebarPreferencesStore.persist.getOptions().migrate;
		const off = await migrate?.(
			{ showWaitingTint: false, showTodos: false },
			1,
		);
		const on = await migrate?.({ showWaitingTint: true }, 1);
		expect(off).toMatchObject({ waitingTint: "off", showTodos: false });
		expect(off).not.toHaveProperty("showWaitingTint");
		expect(on).toMatchObject({ waitingTint: "subtle", showTurnTime: true });
	});
});
