import { describe, expect, test } from "bun:test";
import { findLabels, labelWorkspace } from "./labels";

const labels = [
	{ id: "1", name: "Waiting", color: "amber" },
	{ id: "2", name: "Top priority", color: "red" },
];

describe("labels CLI helpers", () => {
	test("finds labels by name, ignoring case", () => {
		expect(
			findLabels(["waiting", "TOP PRIORITY"], labels).map((l) => l.id),
		).toEqual(["1", "2"]);
		expect(() => findLabels(["Nope"], labels)).toThrow(/No label named Nope/);
	});

	test("defaults to the terminal's workspace", () => {
		expect(labelWorkspace(undefined, { SUPERSET_WORKSPACE_ID: "ws" })).toBe(
			"ws",
		);
		expect(labelWorkspace("other", { SUPERSET_WORKSPACE_ID: "ws" })).toBe(
			"other",
		);
		expect(() => labelWorkspace(undefined, {})).toThrow();
	});
});
