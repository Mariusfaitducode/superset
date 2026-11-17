import { describe, expect, test } from "bun:test";
import { migrateOfficeFilter, useOfficeFilterStore } from "./office-filter";

const empty: ReturnType<typeof migrateOfficeFilter> = {
	states: [],
	projects: [],
	projectStatuses: [],
	rooms: "folders",
};

describe("office filter migration", () => {
	test("turns the old show choice into state filters", () => {
		expect(migrateOfficeFilter({ show: "needsMe" }, 2)).toEqual({
			...empty,
			states: ["waiting"],
		});
		expect(migrateOfficeFilter({ show: "active" }, 1)).toEqual({
			...empty,
			states: ["working"],
		});
		expect(migrateOfficeFilter({ show: "all" }, 2)).toEqual(empty);
	});

	test("reads the v0 on/off switch", () => {
		expect(migrateOfficeFilter({ onlyNeedsMe: true }, 0).states).toEqual([
			"waiting",
		]);
		expect(migrateOfficeFilter({}, 0)).toEqual(empty);
	});

	test("drops unknown states", () => {
		expect(
			migrateOfficeFilter({ states: ["done", "bogus"], rooms: "projects" }, 3),
		).toEqual({ ...empty, states: ["done"], rooms: "projects" });
	});
});

describe("state chips", () => {
	test("solo shows one state, and a second solo shows them all again", () => {
		const store = useOfficeFilterStore.getState();
		store.toggleState("todos");
		store.soloState("waiting");
		expect(useOfficeFilterStore.getState().states).toEqual(["waiting"]);
		store.soloState("waiting");
		expect(useOfficeFilterStore.getState().states).toEqual([]);
	});
});
