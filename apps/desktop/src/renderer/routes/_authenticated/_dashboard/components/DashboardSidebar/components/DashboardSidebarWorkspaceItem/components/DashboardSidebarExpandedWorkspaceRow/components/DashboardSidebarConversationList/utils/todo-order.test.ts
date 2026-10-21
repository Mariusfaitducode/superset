import { describe, expect, test } from "bun:test";
import {
	compareTodos,
	dueState,
	localDay,
	type OrderableTodo,
} from "./todo-order";

const todo = (overrides: Partial<OrderableTodo> & { name: string }) => ({
	done: false,
	priority: "normal" as const,
	dueOn: null,
	createdAt: 0,
	...overrides,
});

describe("compareTodos", () => {
	test("orders open, priority, due day, then age", () => {
		const list = [
			todo({ name: "done-high", done: true, priority: "high" }),
			todo({ name: "low", priority: "low" }),
			todo({ name: "normal-no-due", createdAt: 1 }),
			todo({ name: "normal-later", dueOn: "2026-11-02" }),
			todo({ name: "normal-soon", dueOn: "2026-10-22" }),
			todo({ name: "high", priority: "high", createdAt: 5 }),
			todo({ name: "normal-no-due-older", createdAt: 0 }),
		];
		expect(list.sort(compareTodos).map((item) => item.name)).toEqual([
			"high",
			"normal-soon",
			"normal-later",
			"normal-no-due-older",
			"normal-no-due",
			"low",
			"done-high",
		]);
	});
});

describe("dueState", () => {
	test("compares calendar days", () => {
		expect(dueState(null, "2026-10-21")).toBeNull();
		expect(dueState("2026-10-20", "2026-10-21")).toBe("overdue");
		expect(dueState("2026-10-21", "2026-10-21")).toBe("today");
		expect(dueState("2026-10-22", "2026-10-21")).toBe("later");
	});

	test("formats the local day", () => {
		expect(localDay(new Date(2026, 0, 5))).toBe("2026-01-05");
	});
});
