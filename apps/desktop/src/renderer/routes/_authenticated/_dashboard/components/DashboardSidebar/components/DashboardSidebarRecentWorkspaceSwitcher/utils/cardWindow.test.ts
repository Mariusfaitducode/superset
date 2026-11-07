import { describe, expect, test } from "bun:test";
import { CARD_MIN_WIDTH, cardCapacity, slideCardWindow } from "./cardWindow";

// Room for exactly 5 cards with the "+N" hints.
const WIDTH = 32 + 20 + 2 * (32 + 10) + 5 * CARD_MIN_WIDTH + 4 * 10;

describe("cardCapacity", () => {
	test("fits fewer cards once the hints take room", () => {
		expect(cardCapacity(WIDTH, true)).toBe(5);
		expect(cardCapacity(WIDTH, false)).toBe(5);
		expect(cardCapacity(WIDTH + 200, false)).toBe(6);
	});

	test("always shows at least one card", () => {
		expect(cardCapacity(100, true)).toBe(1);
	});
});

describe("slideCardWindow", () => {
	const slide = (previousStart: number, index: number, count = 12) =>
		slideCardWindow({ previousStart, index, count, viewportWidth: WIDTH });

	test("shows every card when they fit", () => {
		expect(slide(0, 2, 4)).toEqual({ start: 0, size: 4 });
	});

	test("opens at the start for the flip-back card", () => {
		expect(slide(0, 1)).toEqual({ start: 0, size: 5 });
	});

	test("stays put while the selection is inside the window", () => {
		expect(slide(0, 4)).toEqual({ start: 0, size: 5 });
		expect(slide(3, 5)).toEqual({ start: 3, size: 5 });
	});

	test("moves by one when the selection steps past an edge", () => {
		expect(slide(0, 5)).toEqual({ start: 1, size: 5 });
		expect(slide(3, 2)).toEqual({ start: 2, size: 5 });
	});

	test("jumps to the ends when the selection wraps around", () => {
		expect(slide(7, 0)).toEqual({ start: 0, size: 5 });
		expect(slide(0, 11)).toEqual({ start: 7, size: 5 });
	});
});
