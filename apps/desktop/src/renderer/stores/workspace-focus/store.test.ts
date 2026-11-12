import { beforeEach, describe, expect, test } from "bun:test";
import { isFocusFilterOn, keepFocused } from "./focus";
import { MAX_FOCUSED_WORKSPACES, useWorkspaceFocusStore } from "./store";

describe("workspace focus", () => {
	beforeEach(() =>
		useWorkspaceFocusStore.setState({ ids: [], focusOnly: false }),
	);

	test("toggles a workspace in and out of focus", () => {
		const { toggle } = useWorkspaceFocusStore.getState();
		toggle("a");
		toggle("b");
		toggle("a");
		expect(useWorkspaceFocusStore.getState().ids).toEqual(["b"]);
	});

	test("sets several workspaces at once without duplicates", () => {
		const { setFocused } = useWorkspaceFocusStore.getState();
		setFocused(["a", "b"], true);
		setFocused(["b", "c"], true);
		expect(useWorkspaceFocusStore.getState().ids).toEqual(["a", "b", "c"]);
		setFocused(["a", "c"], false);
		expect(useWorkspaceFocusStore.getState().ids).toEqual(["b"]);
	});

	test("drops the oldest focus past the cap", () => {
		const { setFocused, toggle } = useWorkspaceFocusStore.getState();
		setFocused(
			Array.from({ length: MAX_FOCUSED_WORKSPACES }, (_, index) => `w${index}`),
			true,
		);
		toggle("new");
		const { ids } = useWorkspaceFocusStore.getState();
		expect(ids).toHaveLength(MAX_FOCUSED_WORKSPACES);
		expect(ids[0]).toBe("w1");
		expect(ids.at(-1)).toBe("new");
	});

	test("forgets archived workspaces and keeps the state when none was focused", () => {
		const { setFocused, forget } = useWorkspaceFocusStore.getState();
		setFocused(["a", "b"], true);
		const before = useWorkspaceFocusStore.getState();
		forget(["z"]);
		expect(useWorkspaceFocusStore.getState()).toBe(before);
		forget(["a"]);
		expect(useWorkspaceFocusStore.getState().ids).toEqual(["b"]);
	});
});

describe("focus filter", () => {
	test("rests while no workspace is in focus", () => {
		expect(isFocusFilterOn({ ids: [], focusOnly: true })).toBe(false);
		expect(isFocusFilterOn({ ids: ["a"], focusOnly: false })).toBe(false);
		expect(isFocusFilterOn({ ids: ["a"], focusOnly: true })).toBe(true);
	});

	test("keeps only the items of focused workspaces when on", () => {
		const items = [
			{ id: 1, workspaceId: "a" },
			{ id: 2, workspaceId: "b" },
			{ id: 3, workspaceId: null },
		];
		const focused = new Set(["a"]);
		const of = (item: (typeof items)[number]) => item.workspaceId;
		expect(keepFocused(items, of, focused, true).map((i) => i.id)).toEqual([1]);
		expect(keepFocused(items, of, focused, false)).toBe(items);
	});
});
