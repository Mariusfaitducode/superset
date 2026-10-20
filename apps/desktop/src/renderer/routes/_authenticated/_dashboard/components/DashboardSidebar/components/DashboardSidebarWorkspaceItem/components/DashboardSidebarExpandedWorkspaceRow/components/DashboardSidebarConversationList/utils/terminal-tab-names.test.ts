import { describe, expect, test } from "bun:test";
import { terminalTabNames } from "./terminal-tab-names";

function tab(
	id: string,
	panes: Record<
		string,
		{ kind: string; data: unknown; titleOverride?: string }
	>,
	titleOverride?: string,
) {
	return {
		id,
		titleOverride,
		createdAt: 0,
		activePaneId: null,
		layout: { type: "pane", paneId: Object.keys(panes)[0] },
		panes: Object.fromEntries(
			Object.entries(panes).map(([paneId, pane]) => [
				paneId,
				{ id: paneId, ...pane },
			]),
		),
	};
}

describe("terminalTabNames", () => {
	test("maps each terminal to the name the user gave its tab", () => {
		const names = terminalTabNames({
			version: 1,
			activeTabId: null,
			tabs: [
				tab(
					"t1",
					{ a: { kind: "terminal", data: { terminalId: "x" } } },
					"Fix login",
				),
				tab("t2", { b: { kind: "terminal", data: { terminalId: "y" } } }),
			],
		});
		expect(names.get("x")).toBe("Fix login");
		expect(names.has("y")).toBe(false);
	});

	test("a renamed pane wins over its tab name", () => {
		const names = terminalTabNames({
			version: 1,
			activeTabId: null,
			tabs: [
				tab(
					"t1",
					{
						a: {
							kind: "terminal",
							data: { terminalId: "x" },
							titleOverride: "Migrations",
						},
						b: { kind: "terminal", data: { terminalId: "y" } },
					},
					"Backend",
				),
			],
		});
		expect(names.get("x")).toBe("Migrations");
		expect(names.get("y")).toBe("Backend");
	});

	test("ignores non-terminal panes, blank names and malformed layouts", () => {
		expect(
			terminalTabNames({
				version: 1,
				activeTabId: null,
				tabs: [
					tab("t1", { a: { kind: "browser", data: { url: "x" } } }, "Docs"),
					tab(
						"t2",
						{ b: { kind: "terminal", data: { terminalId: "y" } } },
						"  ",
					),
				],
			}).size,
		).toBe(0);
		expect(terminalTabNames(undefined).size).toBe(0);
		expect(terminalTabNames({ panes: [] }).size).toBe(0);
	});
});
