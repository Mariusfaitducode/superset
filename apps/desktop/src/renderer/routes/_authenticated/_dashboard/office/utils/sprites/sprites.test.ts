import { describe, expect, test } from "bun:test";
import {
	BUBBLE_GLYPHS,
	CHARACTER_SPRITES,
	COFFEE_COLORS,
	COFFEE_COUNTER,
	characterColor,
	characterPalette,
	DIGITS,
	PLANT,
	PLANT_COLORS,
	type SpriteRows,
} from "./sprites";

function expectGrid(rows: SpriteRows, width: number, height: number) {
	expect(rows).toHaveLength(height);
	for (const row of rows) expect(row).toHaveLength(width);
}

describe("sprites", () => {
	test("every character frame is a 16×16 grid in the palette", () => {
		const palette = characterPalette(42);
		for (const rows of Object.values(CHARACTER_SPRITES)) {
			expectGrid(rows, 16, 16);
			for (const cell of rows.join("")) {
				if (cell !== ".") expect(characterColor(palette, cell)).not.toBeNull();
			}
		}
	});

	test("props and glyphs keep their sizes and colors", () => {
		expectGrid(PLANT, 16, 16);
		expectGrid(COFFEE_COUNTER, 32, 16);
		for (const cell of PLANT.join("").replaceAll(".", "")) {
			expect(PLANT_COLORS[cell]).toBeDefined();
		}
		for (const cell of COFFEE_COUNTER.join("").replaceAll(".", "")) {
			expect(COFFEE_COLORS[cell]).toBeDefined();
		}
		for (const glyph of Object.values(BUBBLE_GLYPHS)) expectGrid(glyph, 5, 5);
		for (const digit of Object.values(DIGITS)) expectGrid(digit, 3, 5);
	});
});
