import { describe, expect, it } from "bun:test";
import type {
	ProcessInfo,
	ProcessSnapshot,
} from "main/lib/resource-metrics/process-tree";
import { findOrphanRoots, parseLaunchctlList } from "./orphans";

function buildSnapshot(processes: ProcessInfo[]): ProcessSnapshot {
	const byPid = new Map<number, ProcessInfo>();
	const childrenOf = new Map<number, number[]>();
	for (const p of processes) {
		byPid.set(p.pid, p);
		childrenOf.set(p.ppid, [...(childrenOf.get(p.ppid) ?? []), p.pid]);
	}
	return { byPid, childrenOf };
}

const proc = (pid: number, ppid: number, name: string, memory = 100) => ({
	pid,
	ppid,
	name,
	cpu: 0,
	memory,
});

describe("findOrphanRoots", () => {
	it("flags a dev server whose agent is gone, with its whole tree", () => {
		const snapshot = buildSnapshot([
			proc(10, 1, "node", 300),
			proc(11, 10, "esbuild", 50),
		]);
		expect(findOrphanRoots(snapshot, new Set())).toEqual([
			{ pid: 10, name: "node", cpu: 0, memory: 350, pids: [10, 11] },
		]);
	});

	it("climbs through an orphaned shell to the topmost dev process", () => {
		const snapshot = buildSnapshot([
			proc(20, 1, "zsh"),
			proc(21, 20, "npm"),
			proc(22, 21, "vite"),
		]);
		expect(findOrphanRoots(snapshot, new Set()).map((r) => r.pid)).toEqual([
			21,
		]);
	});

	it("leaves processes alone while a terminal, app or agent owns them", () => {
		const snapshot = buildSnapshot([
			proc(30, 1, "Superset"),
			proc(31, 30, "zsh"),
			proc(32, 31, "claude"),
			proc(33, 32, "node"),
			proc(34, 31, "vite"),
		]);
		expect(findOrphanRoots(snapshot, new Set())).toEqual([]);
	});

	it("never flags protected pids: agents running as node, launchd jobs", () => {
		const snapshot = buildSnapshot([
			proc(40, 1, "node"),
			proc(41, 40, "python3"),
			proc(50, 1, "python3"),
		]);
		expect(findOrphanRoots(snapshot, new Set([40, 50]))).toEqual([]);
	});

	it("ignores shells alone", () => {
		const snapshot = buildSnapshot([proc(60, 1, "zsh")]);
		expect(findOrphanRoots(snapshot, new Set())).toEqual([]);
	});
});

describe("parseLaunchctlList", () => {
	it("keeps the pids of running jobs only", () => {
		const stdout =
			"PID\tStatus\tLabel\n71603\t0\tcom.example.server\n-\t0\tcom.example.idle\n";
		expect([...parseLaunchctlList(stdout)]).toEqual([71603]);
	});
});
