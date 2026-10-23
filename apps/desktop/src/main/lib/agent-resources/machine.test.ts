import { describe, expect, it } from "bun:test";
import type {
	ProcessInfo,
	ProcessSnapshot,
} from "main/lib/resource-metrics/process-tree";
import {
	findDockerVmPids,
	parseDockerMemoryLimit,
	parseSysctlMemory,
} from "./machine";

describe("parseSysctlMemory", () => {
	it("reads swap and the pressure level", () => {
		expect(
			parseSysctlMemory(
				"total = 15360.00M  used = 14551.94M  free = 808.06M  (encrypted)\n2\n",
			),
		).toEqual({
			swapTotal: 15360 * 1024 ** 2,
			swapUsed: 14551.94 * 1024 ** 2,
			pressure: "warn",
		});
	});

	it("leaves the pressure unknown when sysctl doesn't give one", () => {
		expect(
			parseSysctlMemory("total = 0.00M  used = 0.00M  free = 0.00M\n"),
		).toMatchObject({ swapUsed: 0, pressure: null });
	});
});

describe("parseDockerMemoryLimit", () => {
	it("reads both settings file spellings", () => {
		expect(parseDockerMemoryLimit('{"MemoryMiB": 8192}')).toBe(8 * 1024 ** 3);
		expect(parseDockerMemoryLimit('{"memoryMiB": 4096}')).toBe(4 * 1024 ** 3);
		expect(parseDockerMemoryLimit("{}")).toBe(null);
	});
});

describe("findDockerVmPids", () => {
	const snapshot = (names: string[]): ProcessSnapshot => {
		const byPid = new Map<number, ProcessInfo>();
		names.forEach((name, i) => {
			byPid.set(i + 2, { pid: i + 2, ppid: 1, cpu: 0, memory: 0, name });
		});
		return { byPid, childrenOf: new Map() };
	};

	it("counts the Virtualization VM only while Docker runs", () => {
		expect(
			findDockerVmPids(
				snapshot([
					"com.docker.backend",
					"com.apple.Virtualization.VirtualMachine",
				]),
			),
		).toEqual([3]);
		expect(
			findDockerVmPids(snapshot(["com.apple.Virtualization.VirtualMachine"])),
		).toEqual([]);
	});
});
