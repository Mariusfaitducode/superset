import { beforeEach, describe, expect, test } from "bun:test";
import { orderByRecency, useWorkspaceRecencyStore } from "./store";

describe("workspace recency", () => {
	beforeEach(() => {
		useWorkspaceRecencyStore.setState({ recent: [] });
	});

	test("moves the opened workspace to the front without duplicates", () => {
		const { touch } = useWorkspaceRecencyStore.getState();
		touch("a");
		touch("b");
		touch("a");
		expect(useWorkspaceRecencyStore.getState().recent).toEqual(["a", "b"]);
	});

	test("orders opened workspaces first, then the rest in their given order", () => {
		const items = ["a", "b", "c", "d"].map((id) => ({ id }));
		expect(orderByRecency(items, ["c", "a"]).map((item) => item.id)).toEqual([
			"c",
			"a",
			"b",
			"d",
		]);
	});

	test("ignores remembered workspaces that are gone", () => {
		const items = [{ id: "a" }, { id: "b" }];
		expect(orderByRecency(items, ["gone", "b"]).map((item) => item.id)).toEqual(
			["b", "a"],
		);
	});
});
