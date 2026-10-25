import { expect, test } from "bun:test";
import { cpuBusyPercent, sumCpuTimes } from "./cpu";

function core(user: number, sys: number, idle: number) {
	return { times: { user, nice: 0, sys, idle, irq: 0 } };
}

test("busy share is the non-idle part of the delta across all cores", () => {
	const before = sumCpuTimes([core(100, 50, 850), core(0, 0, 1000)]);
	const after = sumCpuTimes([core(400, 100, 1500), core(100, 0, 1900)]);
	// Delta: core 1 = 350 busy / 1000, core 2 = 100 busy / 1000.
	expect(cpuBusyPercent(before, after)).toBe(22.5);
});

test("no elapsed time gives no reading", () => {
	const sample = sumCpuTimes([core(1, 1, 1)]);
	expect(cpuBusyPercent(sample, sample)).toBeNull();
});

test("counters that go backwards never give a reading outside 0–100", () => {
	const before = { idle: 900, total: 1000 };
	expect(cpuBusyPercent(before, { idle: 1000, total: 1050 })).toBe(0);
});
