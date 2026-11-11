import { beforeEach, describe, expect, test } from "bun:test";
import {
	DEFAULT_SIDEBAR_PREFERENCES,
	migrateSidebarPreferences,
	useSidebarPreferencesStore,
} from "./store";

describe("sidebar preferences", () => {
	beforeEach(() => {
		useSidebarPreferencesStore.setState(DEFAULT_SIDEBAR_PREFERENCES);
	});

	test("shows everything by default", () => {
		const state = useSidebarPreferencesStore.getState();
		expect(
			Object.entries(DEFAULT_SIDEBAR_PREFERENCES)
				.filter(([key]) => key.startsWith("show"))
				.every(([, value]) => value === true),
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

	test("a hand-picked state color goes back to the palette's on null", () => {
		const store = useSidebarPreferencesStore.getState();
		store.setStateColor("working", "#123456");
		store.setStateColor("failed", "#654321");
		useSidebarPreferencesStore.getState().setStateColor("working", null);
		expect(useSidebarPreferencesStore.getState().stateColors).toEqual({
			failed: "#654321",
		});
	});

	test("turns v1's tint switch into a tint level", async () => {
		const migrate = migrateSidebarPreferences;
		const off = await migrate({ showWaitingTint: false, showTodos: false }, 1);
		const on = await migrate({ showWaitingTint: true }, 1);
		expect(off).toMatchObject({ waitingTint: "off", showTodos: false });
		expect(off).not.toHaveProperty("showWaitingTint");
		expect(on).toMatchObject({ waitingTint: "subtle", showTurnTime: true });
	});

	test("turns v2's request color into the needs-you color", async () => {
		const migrate = migrateSidebarPreferences;
		const migrated = await migrate(
			{
				stateColors: { request: "#111111", seen: "#222222", failed: "#333333" },
			},
			2,
		);
		expect(migrated).toMatchObject({
			stateColors: { needsYou: "#111111", failed: "#333333" },
		});
		expect(
			(migrated as { stateColors: object }).stateColors,
		).not.toHaveProperty("seen");
	});

	test("drops v3's keep-sidebar-in-settings switch", async () => {
		const migrated = await migrateSidebarPreferences(
			{ keepSidebarInSettings: false, showTodos: false },
			3,
		);
		expect(migrated).toMatchObject({ showTodos: false });
		expect(migrated).not.toHaveProperty("keepSidebarInSettings");
	});
});
