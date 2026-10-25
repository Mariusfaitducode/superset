import { expect, test } from "bun:test";
import type { HostMetrics } from "./fetchHostMetrics";
import { getHostLoad, isHostHot } from "./hostLoad";

const GIB = 1024 ** 3;

function metrics(overrides: {
	cpu?: number | null;
	usedGib?: number;
	swap?: HostMetrics["swap"];
}): HostMetrics {
	return {
		cpu: { usagePercent: overrides.cpu === undefined ? 10 : overrides.cpu },
		memory: { usedBytes: (overrides.usedGib ?? 4) * GIB, totalBytes: 20 * GIB },
		swap: overrides.swap ?? null,
	} as HostMetrics;
}

test("shares are 0–1 of the host's own totals", () => {
	expect(
		getHostLoad(
			metrics({
				cpu: 34,
				usedGib: 11,
				swap: { usedBytes: GIB, totalBytes: 4 * GIB },
			}),
		),
	).toEqual({ cpu: 0.34, memory: 0.55, swap: 0.25 });
});

test("the host turns hot at 85% CPU or memory, not before", () => {
	expect(isHostHot(getHostLoad(metrics({ cpu: 84, usedGib: 16 })))).toBe(false);
	expect(isHostHot(getHostLoad(metrics({ cpu: 85 })))).toBe(true);
	expect(isHostHot(getHostLoad(metrics({ usedGib: 17 })))).toBe(true);
});

test("a first sample without CPU reading is not hot", () => {
	const load = getHostLoad(metrics({ cpu: null }));
	expect(load.cpu).toBeNull();
	expect(isHostHot(load)).toBe(false);
});
