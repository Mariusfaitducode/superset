import { describe, expect, test } from "bun:test";
import {
	countTones,
	deskTone,
	moveFocus,
	type OfficeTone,
	orderIslands,
	toneFor,
	visibleIslands,
} from "./officeStatus";

describe("toneFor", () => {
	test("maps every conversation state to one tone", () => {
		expect(toneFor("request")).toBe("need");
		expect(toneFor("failed")).toBe("failed");
		expect(toneFor("unseen")).toBe("done");
		expect(toneFor("working")).toBe("working");
		expect(toneFor("seen")).toBe("idle");
		expect(toneFor("idle")).toBe("idle");
	});
});

describe("countTones", () => {
	test("counts questions, errors and unseen results as needing you", () => {
		expect(
			countTones(["need", "failed", "done", "working", "working", "idle"]),
		).toEqual({ needYou: 3, working: 2 });
		expect(countTones([])).toEqual({ needYou: 0, working: 0 });
	});
});

function island(name: string, tones: OfficeTone[]) {
	return { name, tones };
}

describe("orderIslands", () => {
	test("puts the island that needs you first, then the busiest", () => {
		const ordered = orderIslands([
			island("Alpha", ["idle"]),
			island("Bravo", ["working", "working"]),
			island("Charlie", ["done"]),
			island("Delta", ["working", "need"]),
			island("Echo", ["failed"]),
		]);
		expect(ordered.map((entry) => entry.name)).toEqual([
			"Delta",
			"Echo",
			"Charlie",
			"Bravo",
			"Alpha",
		]);
	});

	test("a workspace without chats goes after idle ones", () => {
		const ordered = orderIslands([
			island("Alpha", []),
			island("Bravo", ["idle"]),
		]);
		expect(ordered.map((entry) => entry.name)).toEqual(["Bravo", "Alpha"]);
	});

	test("more agents waiting ranks higher; ties fall back to the name", () => {
		const ordered = orderIslands([
			island("Zulu", ["need"]),
			island("Yankee", ["need", "need"]),
			island("Bravo", ["idle"]),
			island("Alpha", ["idle"]),
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
		expect(deskTone(["idle", "working", "done"])).toBe("done");
		expect(deskTone(["working", "need", "failed"])).toBe("need");
		expect(deskTone(["idle"])).toBe("idle");
	});

	test("is null for a workspace without chats", () => {
		expect(deskTone([])).toBeNull();
	});
});

describe("visibleIslands", () => {
	const islands = [
		island("quiet", ["idle", "working"]),
		island("asks", ["idle", "need"]),
		island("done", ["done"]),
		island("resting", ["idle"]),
		island("empty", []),
	];

	test("keeps every island by default", () => {
		expect(visibleIslands(islands, "all")).toHaveLength(5);
	});

	test("keeps only islands where an agent is not resting", () => {
		expect(
			visibleIslands(islands, "active").map((entry) => entry.name),
		).toEqual(["quiet", "asks", "done"]);
	});

	test("keeps only islands where someone needs you", () => {
		expect(
			visibleIslands(islands, "needsMe").map((entry) => entry.name),
		).toEqual(["asks", "done"]);
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
