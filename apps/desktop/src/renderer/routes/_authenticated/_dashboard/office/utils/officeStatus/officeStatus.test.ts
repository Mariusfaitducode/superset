import { describe, expect, test } from "bun:test";
import {
	countTones,
	deskTone,
	moveFocus,
	type OfficeTone,
	orderIslands,
} from "./officeStatus";

describe("countTones", () => {
	test("counts the agents waiting on you and the ones at work", () => {
		expect(
			countTones(["waiting", "waiting", "working", "todos", "done", "resume"]),
		).toEqual({ needYou: 2, working: 1 });
		expect(countTones([])).toEqual({ needYou: 0, working: 0 });
	});
});

function island(name: string, tones: OfficeTone[]) {
	return { name, tones };
}

describe("orderIslands", () => {
	test("waiting first, then working, then to-dos to pick up", () => {
		const ordered = orderIslands([
			island("Alpha", ["resume"]),
			island("Bravo", ["working", "working"]),
			island("Charlie", ["todos"]),
			island("Delta", ["working", "waiting"]),
			island("Echo", ["done"]),
		]);
		expect(ordered.map((entry) => entry.name)).toEqual([
			"Delta",
			"Bravo",
			"Charlie",
			"Alpha",
			"Echo",
		]);
	});

	test("a workspace without chats goes last", () => {
		const ordered = orderIslands([
			island("Alpha", []),
			island("Bravo", ["done"]),
		]);
		expect(ordered.map((entry) => entry.name)).toEqual(["Bravo", "Alpha"]);
	});

	test("more agents waiting ranks higher; ties fall back to the name", () => {
		const ordered = orderIslands([
			island("Zulu", ["waiting"]),
			island("Yankee", ["waiting", "waiting"]),
			island("Bravo", ["resume"]),
			island("Alpha", ["resume"]),
		]);
		expect(ordered.map((entry) => entry.name)).toEqual([
			"Yankee",
			"Zulu",
			"Alpha",
			"Bravo",
		]);
	});
});

describe("deskTone", () => {
	test("is the most urgent tone among a workspace's chats", () => {
		expect(deskTone(["resume", "working", "done"])).toBe("working");
		expect(deskTone(["working", "waiting", "todos"])).toBe("waiting");
		expect(deskTone(["done"])).toBe("done");
	});

	test("is null for a workspace without chats", () => {
		expect(deskTone([])).toBeNull();
	});
});

describe("moveFocus", () => {
	// Two rows: three agents on top, two below.
	const points = [
		{ x: 0, y: 0 },
		{ x: 3, y: 0 },
		{ x: 6, y: 0 },
		{ x: 0, y: 5 },
		{ x: 5, y: 5 },
	];

	test("left and right follow reading order and stop at the ends", () => {
		expect(moveFocus(points, 1, "ArrowRight")).toBe(2);
		expect(moveFocus(points, 2, "ArrowRight")).toBe(3);
		expect(moveFocus(points, 4, "ArrowRight")).toBe(4);
		expect(moveFocus(points, 0, "ArrowLeft")).toBe(0);
	});

	test("up and down pick the nearest agent on the next row", () => {
		expect(moveFocus(points, 2, "ArrowDown")).toBe(4);
		expect(moveFocus(points, 0, "ArrowDown")).toBe(3);
		expect(moveFocus(points, 4, "ArrowUp")).toBe(2);
		expect(moveFocus(points, 1, "ArrowUp")).toBe(1);
	});

	test("an unknown start stays put", () => {
		expect(moveFocus(points, 9, "ArrowDown")).toBe(9);
	});
});
