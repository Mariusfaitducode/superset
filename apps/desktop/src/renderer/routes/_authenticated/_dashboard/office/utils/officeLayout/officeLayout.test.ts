import { describe, expect, test } from "bun:test";
import {
	CORRIDOR_X,
	layoutOffice,
	pathToCoffee,
	SEATS_PER_ROW,
	WALL_HEIGHT,
} from "./officeLayout";

function overlaps(
	a: { x: number; y: number; width: number; height: number },
	b: { x: number; y: number; width: number; height: number },
) {
	return (
		a.x < b.x + b.width &&
		b.x < a.x + a.width &&
		a.y < b.y + b.height &&
		b.y < a.y + a.height
	);
}

describe("layoutOffice", () => {
	test("gives every agent its own seat on its workspace's island", () => {
		const layout = layoutOffice({
			islands: [
				{ id: "a", seats: 1 },
				{ id: "b", seats: 3 },
			],
			maxWidth: 40,
			devices: 0,
		});
		expect(layout.islands.map((island) => island.seats.length)).toEqual([1, 3]);
		const seats = layout.islands.flatMap((island) => island.seats);
		const keys = new Set(seats.map((seat) => `${seat.x},${seat.y}`));
		expect(keys.size).toBe(seats.length);
	});

	test("wraps islands into rows that fit the width, without overlap", () => {
		const layout = layoutOffice({
			islands: Array.from({ length: 6 }, (_, index) => ({
				id: String(index),
				seats: 4,
			})),
			maxWidth: 30,
			devices: 0,
		});
		for (const island of layout.islands) {
			expect(island.x + island.width).toBeLessThanOrEqual(layout.width);
			expect(island.y + island.height).toBeLessThanOrEqual(layout.height);
			expect(island.y).toBeGreaterThan(WALL_HEIGHT);
		}
		layout.islands.forEach((island, index) => {
			for (const other of layout.islands.slice(index + 1)) {
				expect(overlaps(island, other)).toBe(false);
			}
		});
		expect(new Set(layout.islands.map((island) => island.y)).size).toBe(3);
	});

	test("stacks more agents than a row holds into extra desk rows", () => {
		const layout = layoutOffice({
			islands: [{ id: "a", seats: SEATS_PER_ROW + 1 }],
			maxWidth: 20,
			devices: 0,
		});
		const island = layout.islands[0];
		expect(island?.height).toBe(6);
		expect(island?.seats[SEATS_PER_ROW]?.y).toBe((island?.y ?? 0) + 3);
	});

	test("widens the room for an island wider than the window", () => {
		const layout = layoutOffice({
			islands: [{ id: "a", seats: 4 }],
			maxWidth: 4,
			devices: 0,
		});
		const island = layout.islands[0];
		expect(layout.width).toBeGreaterThanOrEqual(
			(island?.x ?? 0) + (island?.width ?? 0),
		);
	});

	test("adds a rack per four connections", () => {
		expect(
			layoutOffice({ islands: [], maxWidth: 30, devices: 0 }).racks,
		).toHaveLength(1);
		expect(
			layoutOffice({ islands: [], maxWidth: 30, devices: 5 }).racks,
		).toHaveLength(2);
	});
});

describe("pathToCoffee", () => {
	test("leaves the island by its left edge and ends at the counter", () => {
		const layout = layoutOffice({
			islands: [
				{ id: "a", seats: 2 },
				{ id: "b", seats: 2 },
			],
			maxWidth: 40,
			devices: 0,
		});
		const island = layout.islands[1];
		const seat = island?.seats[1];
		if (!island || !seat) throw new Error("no seat");
		const path = pathToCoffee(island, seat, layout);
		expect(path[0]).toEqual({ x: seat.x, y: seat.y });
		expect(path[1]).toEqual({ x: island.x, y: seat.y });
		expect(path.at(-1)).toEqual(layout.coffeeSpot);
		expect(path.some((point) => point.x === CORRIDOR_X)).toBe(true);
		for (let index = 1; index < path.length; index++) {
			const from = path[index - 1];
			const to = path[index];
			expect(from?.x === to?.x || from?.y === to?.y).toBe(true);
		}
	});
});
