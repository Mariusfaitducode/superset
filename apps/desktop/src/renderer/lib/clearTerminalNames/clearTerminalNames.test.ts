import { describe, expect, test } from "bun:test";
import type { Tab, WorkspaceState } from "@superset/panes";
import { clearTerminalNames } from "./clearTerminalNames";

type Data = { terminalId?: string };

function tab(
	id: string,
	panes: Tab<Data>["panes"],
	extra: Partial<Tab<Data>> = {},
): Tab<Data> {
	return {
		id,
		createdAt: 0,
		activePaneId: Object.keys(panes)[0] ?? null,
		layout: {
			type: "pane",
			paneId: Object.keys(panes)[0] ?? "",
		} as Tab<Data>["layout"],
		panes,
		...extra,
	};
}

describe("clearTerminalNames", () => {
	test("drops the pane and tab names of the renamed terminal only", () => {
		const layout: WorkspaceState<Data> = {
			version: 1,
			activeTabId: "a",
			tabs: [
				tab(
					"a",
					{
						p1: {
							id: "p1",
							kind: "terminal",
							titleOverride: "Claude",
							data: { terminalId: "t1" },
						},
					},
					{ titleOverride: "Old name" },
				),
				tab(
					"b",
					{
						p2: {
							id: "p2",
							kind: "terminal",
							titleOverride: "Keep",
							data: { terminalId: "t2" },
						},
					},
					{ titleOverride: "Other" },
				),
			],
		} as WorkspaceState<Data>;

		const next = clearTerminalNames(layout, "t1");

		expect(next.tabs[0]?.titleOverride).toBeUndefined();
		expect(next.tabs[0]?.panes.p1?.titleOverride).toBeUndefined();
		expect(next.tabs[1]).toBe(layout.tabs[1]);
	});

	test("keeps a split tab's name when another pane names it", () => {
		const layout = {
			version: 1,
			activeTabId: "a",
			tabs: [
				tab(
					"a",
					{
						p1: { id: "p1", kind: "terminal", data: { terminalId: "t1" } },
						p2: { id: "p2", kind: "terminal", data: { terminalId: "t2" } },
					},
					{ titleOverride: "Split", activePaneId: "p2" },
				),
			],
		} as WorkspaceState<Data>;

		expect(clearTerminalNames(layout, "t1")).toBe(layout);
	});
});
