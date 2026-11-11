import { describe, expect, test } from "bun:test";
import { fitCamera, MAX_ZOOM, zoomAround } from "./useOfficeCamera";

describe("office camera", () => {
	test("fits a rectangle whole and centered", () => {
		const camera = fitCamera(
			{ x: 0, y: 0, width: 1000, height: 500 },
			{ width: 548, height: 548 },
		);
		expect(camera.zoom).toBeCloseTo(0.5);
		expect(camera.x).toBeCloseTo(24);
		expect(camera.y).toBeCloseTo((548 - 250) / 2);
	});

	test("zooming keeps the point under the pointer still", () => {
		const before = { x: 10, y: 20, zoom: 1 };
		const at = { x: 200, y: 100 };
		const after = zoomAround(before, 2, at);
		const worldBefore = (at.x - before.x) / before.zoom;
		const worldAfter = (at.x - after.x) / after.zoom;
		expect(worldAfter).toBeCloseTo(worldBefore);
	});

	test("never zooms past the limits", () => {
		expect(zoomAround({ x: 0, y: 0, zoom: 3 }, 10, { x: 0, y: 0 }).zoom).toBe(
			MAX_ZOOM,
		);
	});
});
