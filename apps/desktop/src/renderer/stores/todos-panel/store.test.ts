import { beforeEach, expect, test } from "bun:test";
import { useTodosPanelStore } from "./store";

beforeEach(() => {
	useTodosPanelStore.setState({ focusByWorkspace: {}, openRequest: null });
});

test("an open request is consumed once, by its own workspace", () => {
	useTodosPanelStore.getState().open("w1", "t1");
	expect(useTodosPanelStore.getState().focusByWorkspace).toEqual({ w1: "t1" });
	expect(useTodosPanelStore.getState().consume("w2")).toBe(false);
	expect(useTodosPanelStore.getState().consume("w1")).toBe(true);
	expect(useTodosPanelStore.getState().consume("w1")).toBe(false);
	expect(useTodosPanelStore.getState().focusByWorkspace).toEqual({ w1: "t1" });
});
