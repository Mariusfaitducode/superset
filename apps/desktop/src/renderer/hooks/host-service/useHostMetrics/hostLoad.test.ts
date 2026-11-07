import { describe, expect, test } from "bun:test";
import type { HostMetrics } from "./fetchHostMetrics";
import { getHostLoad, getHostVerdict, worstVerdict } from "./hostLoad";

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

describe("getHostVerdict", () => {
	const verdict = (overrides: Parameters<typeof metrics>[0]) =>
		getHostVerdict(getHostLoad(metrics(overrides)));

	test("memory sets the verdict: tight from 75%, critical from 90%", () => {
		expect(verdict({ usedGib: 14 })).toBe("room");
		expect(verdict({ usedGib: 15 })).toBe("tight");
		expect(verdict({ usedGib: 18 })).toBe("critical");
	});

	test("a nearly full swap or saturated CPU makes it tight, never critical", () => {
		expect(verdict({ swap: { usedBytes: 3 * GIB, totalBytes: 4 * GIB } })).toBe(
			"tight",
		);
		expect(verdict({ cpu: 89 })).toBe("room");
		expect(verdict({ cpu: 100 })).toBe("tight");
	});

	test("a first sample without CPU reading still has a verdict", () => {
		expect(verdict({ cpu: null })).toBe("room");
	});
});

test("worstVerdict picks the most loaded host", () => {
	expect(worstVerdict([])).toBeNull();
	expect(worstVerdict(["room", "critical", "tight"])).toBe("critical");
	expect(worstVerdict(["room", "tight"])).toBe("tight");
});
