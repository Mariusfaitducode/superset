import { describe, expect, test } from "bun:test";
import { buildAppearanceVars, STATE_PALETTES } from "./appearance";
import { DEFAULT_SIDEBAR_PREFERENCES } from "./store";

describe("sidebar appearance", () => {
	test("hand-picked colors win over the palette", () => {
		const vars = buildAppearanceVars({
			...DEFAULT_SIDEBAR_PREFERENCES,
			statePalette: "neon",
			stateColors: { failed: "#000000" },
		});
		expect(vars["--sb-state-failed"]).toBe("#000000");
		expect(vars["--sb-state-working"]).toBe(STATE_PALETTES.neon.working);
	});

	test("density sets the row heights", () => {
		const compact = buildAppearanceVars({
			...DEFAULT_SIDEBAR_PREFERENCES,
			density: "compact",
		});
		const comfortable = buildAppearanceVars({
			...DEFAULT_SIDEBAR_PREFERENCES,
			density: "comfortable",
		});
		expect(Number.parseInt(compact["--sb-conv-h"] ?? "", 10)).toBeLessThan(
			Number.parseInt(comfortable["--sb-conv-h"] ?? "", 10),
		);
		expect(compact["--sb-band"]).toBe("3px");
	});
});
