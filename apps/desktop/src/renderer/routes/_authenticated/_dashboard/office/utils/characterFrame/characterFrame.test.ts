import { describe, expect, test } from "bun:test";
import {
	bubbleFor,
	characterFrame,
	pathLength,
	pointAlong,
} from "./characterFrame";

const PATH = [
	{ x: 5.5, y: 6 },
	{ x: 4, y: 6 },
	{ x: 4, y: 4 },
	{ x: 2, y: 4 },
	{ x: 2, y: 3 },
];

describe("bubbleFor", () => {
	test("asks for the user on approval, errors and finished turns", () => {
		expect(bubbleFor("request")).toBe("approval");
		expect(bubbleFor("failed")).toBe("error");
		expect(bubbleFor("unseen")).toBe("done");
		expect(bubbleFor("seen")).toBe("waiting");
		expect(bubbleFor("working")).toBeNull();
		expect(bubbleFor("idle")).toBeNull();
	});
});

describe("pointAlong", () => {
	test("walks the segments in order", () => {
		expect(pathLength(PATH)).toBe(6.5);
		expect(pointAlong(PATH, 0)).toMatchObject({ x: 5.5, y: 6 });
		expect(pointAlong(PATH, 2.5)).toMatchObject({
			x: 4,
			y: 5,
			facing: "up",
		});
		expect(pointAlong(PATH, 100)).toMatchObject({ x: 2, y: 3 });
	});
});

describe("characterFrame", () => {
	const base = { path: PATH, seed: 0, reducedMotion: false };

	test("a working agent types at its desk", () => {
		const frames = [0, 250].map((timeMs) =>
			characterFrame({ ...base, state: "working", timeMs }),
		);
		expect(frames.map((frame) => frame.pose)).toEqual(["type", "type"]);
		expect(frames.map((frame) => frame.step)).toEqual([0, 1]);
		expect(frames[0]).toMatchObject({ x: 5.5, y: 6, bubble: null });
	});

	test("an agent waiting on the user stays seated with its bubble", () => {
		for (const timeMs of [0, 30_000, 60_000]) {
			expect(
				characterFrame({ ...base, state: "request", timeMs }),
			).toMatchObject({ x: 5.5, y: 6, pose: "sit", bubble: "approval" });
		}
	});

	test("an idle agent sits, walks to the coffee, waits and comes back", () => {
		const poses = new Set<string>();
		let reachedCoffee = false;
		for (let timeMs = 0; timeMs < 120_000; timeMs += 100) {
			const frame = characterFrame({ ...base, state: "idle", timeMs });
			poses.add(frame.pose);
			if (frame.pose === "stand") {
				expect(frame).toMatchObject({ x: 2, y: 3 });
				reachedCoffee = true;
			}
			expect(frame.bubble).toBeNull();
		}
		expect(poses).toEqual(new Set(["sit", "walk", "stand"]));
		expect(reachedCoffee).toBe(true);
	});

	test("reduced motion keeps every agent seated and still", () => {
		for (const timeMs of [0, 250, 40_000, 70_000]) {
			for (const state of ["idle", "working"] as const) {
				const frame = characterFrame({
					...base,
					reducedMotion: true,
					state,
					timeMs,
				});
				expect(frame).toMatchObject({ x: 5.5, y: 6, step: 0 });
			}
		}
	});
});
