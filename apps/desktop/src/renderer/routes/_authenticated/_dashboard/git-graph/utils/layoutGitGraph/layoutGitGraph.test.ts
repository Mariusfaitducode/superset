import { describe, expect, it } from "bun:test";
import { layoutGitGraph } from "./layoutGitGraph";

const c = (hash: string, ...parents: string[]) => ({ hash, parents });

describe("layoutGitGraph", () => {
	it("keeps a straight history in one lane and one color", () => {
		const rows = layoutGitGraph([c("c", "b"), c("b", "a"), c("a")]);
		expect(rows.map((row) => [row.lane, row.color])).toEqual([
			[0, 0],
			[0, 0],
			[0, 0],
		]);
		expect(rows[1]?.incoming).toEqual([{ from: 0, color: 0 }]);
		expect(rows[2]?.outgoing).toEqual([]);
	});

	it("opens a lane for a branch and closes it at the fork point", () => {
		// m merges f into main; f and b both come from a.
		const rows = layoutGitGraph([
			c("m", "b", "f"),
			c("f", "a"),
			c("b", "a"),
			c("a"),
		]);
		expect(rows[0]).toMatchObject({
			lane: 0,
			outgoing: [
				{ to: 0, color: 0 },
				{ to: 1, color: 1 },
			],
		});
		expect(rows[1]).toMatchObject({
			lane: 1,
			color: 1,
			passing: [{ lane: 0, color: 0 }],
		});
		// b keeps main's lane; f's lane still waits for a.
		expect(rows[2]).toMatchObject({
			lane: 0,
			passing: [{ lane: 1, color: 1 }],
			outgoing: [{ to: 0, color: 0 }],
		});
		// a closes both lanes.
		expect(rows[3]).toMatchObject({
			lane: 0,
			incoming: [
				{ from: 0, color: 0 },
				{ from: 1, color: 1 },
			],
			width: 2,
		});
	});

	it("gives unrelated branch tips their own lane and color", () => {
		const rows = layoutGitGraph([c("x", "a"), c("y", "a"), c("a")]);
		expect(rows.map((row) => row.lane)).toEqual([0, 1, 0]);
		expect(rows[1]?.color).not.toBe(rows[0]?.color);
		// Both lanes wait for a and meet at its row, in the leftmost lane.
		expect(rows[2]).toMatchObject({
			lane: 0,
			incoming: [
				{ from: 0, color: 0 },
				{ from: 1, color: rows[1]?.color },
			],
		});
	});

	it("reuses freed lanes so the graph stays narrow", () => {
		const rows = layoutGitGraph([
			c("m", "b", "f"),
			c("f", "a"),
			c("b", "a"),
			c("a", "z"),
			c("y", "z"),
			c("z"),
		]);
		expect(rows[4]?.lane).toBe(1);
		expect(Math.max(...rows.map((row) => row.width))).toBe(2);
	});
});
