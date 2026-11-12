import { describe, expect, test } from "bun:test";
import { migrateOfficeFilter } from "./office-filter";

describe("office filter migration", () => {
	test("renames the old Active filter to Working", () => {
		expect(migrateOfficeFilter({ show: "active" }, 1)).toEqual({
			show: "working",
		});
		expect(migrateOfficeFilter({ show: "needsMe" }, 1)).toEqual({
			show: "needsMe",
		});
	});

	test("reads the v0 on/off switch", () => {
		expect(migrateOfficeFilter({ onlyNeedsMe: true }, 0)).toEqual({
			show: "needsMe",
		});
		expect(migrateOfficeFilter({}, 0)).toEqual({ show: "all" });
	});
});
