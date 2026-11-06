import { describe, expect, test } from "bun:test";
import {
	CORRIDOR_X,
	DESK_GAP,
	deskSize,
	HEADER_HEIGHT,
	layoutOffice,
	type OfficeDesk,
	type OfficeRoom,
	PLATE_HEIGHT,
	pathToCoffee,
	ROW_PITCH,
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

function inside(
	inner: { x: number; y: number; width: number; height: number },
	outer: { x: number; y: number; width: number; height: number },
) {
	return (
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.width <= outer.x + outer.width &&
		inner.y + inner.height <= outer.y + outer.height
	);
}

function room(id: string, seats: number[]) {
	return {
		id,
		desks: seats.map((count, index) => ({
			id: `${id}-${index}`,
			seats: count,
		})),
	};
}

function onlyRoom(rooms: OfficeRoom[]): OfficeRoom {
	const first = rooms[0];
	if (!first) throw new Error("no room");
	return first;
}

describe("deskSize", () => {
	test("grows with the chats and wraps past a row", () => {
		expect(deskSize(1).columns).toBe(1);
		expect(deskSize(3).columns).toBe(3);
		expect(deskSize(SEATS_PER_ROW + 1)).toMatchObject({
			columns: SEATS_PER_ROW,
			rows: 2,
		});
		expect(deskSize(4).width).toBeGreaterThan(deskSize(1).width);
	});

	test("an empty workspace keeps a one-seat desk", () => {
		expect(deskSize(0)).toEqual(deskSize(1));
	});
});

describe("layoutOffice", () => {
	test("gives every chat its own seat on its workspace's desk", () => {
		const layout = layoutOffice({
			rooms: [room("a", [1, 3]), room("b", [2])],
			maxWidth: 60,
			devices: 0,
		});
		expect(
			layout.rooms.map((entry) => entry.desks.map((d) => d.seats.length)),
		).toEqual([[1, 3], [2]]);
		const seats = layout.rooms.flatMap((entry) =>
			entry.desks.flatMap((desk) => desk.seats),
		);
		const keys = new Set(seats.map((seat) => `${seat.x},${seat.y}`));
		expect(keys.size).toBe(seats.length);
	});

	test("an empty workspace still has a desk with one empty seat", () => {
		const layout = layoutOffice({
			rooms: [room("a", [0])],
			maxWidth: 40,
			devices: 0,
		});
		expect(onlyRoom(layout.rooms).desks[0]?.seats).toHaveLength(1);
	});

	test("keeps desks inside their room, side by side, without overlap", () => {
		const layout = layoutOffice({
			rooms: [room("a", [1, 4, 2, 6, 1])],
			maxWidth: 40,
			devices: 0,
		});
		const only = onlyRoom(layout.rooms);
		only.desks.forEach((desk, index) => {
			expect(inside(desk, only)).toBe(true);
			expect(desk.y).toBeGreaterThanOrEqual(only.y + HEADER_HEIGHT);
			for (const other of only.desks.slice(index + 1)) {
				expect(overlaps(desk, other)).toBe(false);
			}
		});
		// Five desks do not fit one row of a 40-tile office.
		expect(new Set(only.desks.map((desk) => desk.y)).size).toBeGreaterThan(1);
		expect(only.x + only.width).toBeLessThanOrEqual(layout.width);
	});

	test("leaves a gap between neighbouring desks", () => {
		const layout = layoutOffice({
			rooms: [room("a", [1, 1])],
			maxWidth: 60,
			devices: 0,
		});
		const [first, second] = onlyRoom(layout.rooms).desks as [
			OfficeDesk,
			OfficeDesk,
		];
		expect(second.x - (first.x + first.width)).toBe(DESK_GAP);
		expect(second.y).toBe(first.y);
	});

	test("keeps the plate, bubbles and desks inside each cubicle", () => {
		const layout = layoutOffice({
			rooms: [room("a", [SEATS_PER_ROW + 2, 1])],
			maxWidth: 60,
			devices: 0,
		});
		for (const desk of onlyRoom(layout.rooms).desks) {
			expect(desk.plate).toEqual({ x: desk.x, y: desk.y, width: desk.width });
			for (const seat of desk.seats) {
				expect(seat.y - 1).toBeGreaterThanOrEqual(desk.y + PLATE_HEIGHT);
				expect(seat.desk.y).toBeLessThan(desk.y + desk.height);
				expect(seat.desk.x).toBeGreaterThan(desk.x);
				expect(seat.desk.x + 2).toBeLessThanOrEqual(desk.x + desk.width);
			}
		}
	});

	test("stacks more chats than a row holds into extra seat rows", () => {
		const layout = layoutOffice({
			rooms: [room("a", [SEATS_PER_ROW + 1])],
			maxWidth: 40,
			devices: 0,
		});
		const desk = onlyRoom(layout.rooms).desks[0];
		expect(desk?.height).toBe(PLATE_HEIGHT + 2 * ROW_PITCH + 1);
		expect(desk?.seats[SEATS_PER_ROW]?.y).toBe(
			(desk?.seats[0]?.y ?? 0) + ROW_PITCH,
		);
	});

	test("wraps rooms into rows that fit the width, without overlap", () => {
		const layout = layoutOffice({
			rooms: Array.from({ length: 6 }, (_, index) =>
				room(String(index), [2, 2]),
			),
			maxWidth: 45,
			devices: 0,
		});
		for (const entry of layout.rooms) {
			expect(entry.x + entry.width).toBeLessThanOrEqual(layout.width);
			expect(entry.y + entry.height).toBeLessThanOrEqual(layout.height);
			expect(entry.y).toBeGreaterThan(WALL_HEIGHT);
		}
		layout.rooms.forEach((entry, index) => {
			for (const other of layout.rooms.slice(index + 1)) {
				expect(overlaps(entry, other)).toBe(false);
			}
		});
		expect(new Set(layout.rooms.map((entry) => entry.y)).size).toBe(3);
	});

	test("widens the office for a desk wider than the window", () => {
		const layout = layoutOffice({
			rooms: [room("a", [4])],
			maxWidth: 4,
			devices: 0,
		});
		const only = onlyRoom(layout.rooms);
		expect(layout.width).toBeGreaterThanOrEqual(only.x + only.width);
	});

	test("adds a rack per four connections", () => {
		expect(
			layoutOffice({ rooms: [], maxWidth: 30, devices: 0 }).racks,
		).toHaveLength(1);
		expect(
			layoutOffice({ rooms: [], maxWidth: 30, devices: 5 }).racks,
		).toHaveLength(2);
	});
});

describe("pathToCoffee", () => {
	test("leaves the room by its left edge and ends at the counter", () => {
		const layout = layoutOffice({
			rooms: [room("a", [2]), room("b", [2, 2])],
			maxWidth: 60,
			devices: 0,
		});
		const target = layout.rooms[1];
		const seat = target?.desks[1]?.seats[1];
		if (!target || !seat) throw new Error("no seat");
		const path = pathToCoffee(target, seat, layout);
		expect(path[0]).toEqual({ x: seat.x, y: seat.y });
		expect(path[1]).toEqual({ x: target.x, y: seat.y });
		expect(path.at(-1)).toEqual(layout.coffeeSpot);
		expect(path.some((point) => point.x === CORRIDOR_X)).toBe(true);
		for (let index = 1; index < path.length; index++) {
			const from = path[index - 1];
			const to = path[index];
			expect(from?.x === to?.x || from?.y === to?.y).toBe(true);
		}
	});
});
