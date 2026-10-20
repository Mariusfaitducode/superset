import { beforeEach, describe, expect, test } from "bun:test";
import { useVisibleTerminalsStore } from "./store";

const store = () => useVisibleTerminalsStore.getState();

describe("visible terminals", () => {
	beforeEach(() => {
		useVisibleTerminalsStore.setState({ terminalIdBySlot: {} });
	});

	test("tracks one terminal per pane area", () => {
		store().setVisibleTerminal("center", "t1");
		store().setVisibleTerminal("right", "t2");
		store().setVisibleTerminal("center", "t3");
		expect(store().terminalIdBySlot).toEqual({ center: "t3", right: "t2" });
	});

	test("clearing a pane area drops its key", () => {
		store().setVisibleTerminal("center", "t1");
		store().setVisibleTerminal("center", null);
		expect(store().terminalIdBySlot).toEqual({});
	});
});
