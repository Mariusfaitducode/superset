import { describe, expect, test } from "bun:test";
import { parseMeminfo, parseVmStatAvailableBytes } from "./memory";

const KIB = 1024;

describe("parseMeminfo", () => {
	test("uses MemAvailable, not MemFree, and reads swap", () => {
		const text = [
			"MemTotal:       20000000 kB",
			"MemFree:         1000000 kB",
			"MemAvailable:    9000000 kB",
			"Buffers:          200000 kB",
			"Cached:          7000000 kB",
			"SwapCached:            0 kB",
			"SwapTotal:       5000000 kB",
			"SwapFree:        4000000 kB",
			"HugePages_Total:       0",
			"",
		].join("\n");
		expect(parseMeminfo(text)).toEqual({
			totalBytes: 20000000 * KIB,
			availableBytes: 9000000 * KIB,
			swap: { totalBytes: 5000000 * KIB, usedBytes: 1000000 * KIB },
		});
	});

	test("a kernel without MemAvailable falls back to free + buffers + cache", () => {
		const text = [
			"MemTotal: 1000 kB",
			"MemFree: 100 kB",
			"Buffers: 50 kB",
			"Cached: 250 kB",
			"SwapTotal: 0 kB",
			"SwapFree: 0 kB",
		].join("\n");
		expect(parseMeminfo(text)).toEqual({
			totalBytes: 1000 * KIB,
			availableBytes: 400 * KIB,
			swap: null,
		});
	});

	test("text without MemTotal is not a reading", () => {
		expect(parseMeminfo("")).toBeNull();
		expect(parseMeminfo("garbage\n")).toBeNull();
	});
});

describe("parseVmStatAvailableBytes", () => {
	test("counts free, inactive and speculative pages", () => {
		const text = [
			"Mach Virtual Memory Statistics: (page size of 16384 bytes)",
			"Pages free:                               10.",
			"Pages active:                            500.",
			"Pages inactive:                           20.",
			"Pages speculative:                         5.",
			"Pages wired down:                        100.",
		].join("\n");
		expect(parseVmStatAvailableBytes(text)).toBe(35 * 16384);
	});

	test("output without a page size is not a reading", () => {
		expect(parseVmStatAvailableBytes("Pages free: 10.")).toBeNull();
	});
});
