import { expect, test } from "bun:test";
import type { TerminalAgentBinding } from "../../terminal-agents/types";
import {
	createHostMetricsCollector,
	type HostMetricsSources,
} from "./host-metrics";
import { parseProcessTable } from "./process-table";

const GIB = 1024 ** 3;

function agent(terminalId: string, ended = false): TerminalAgentBinding {
	return {
		terminalId,
		workspaceId: "ws",
		agentId: "claude",
		startedAt: 1,
		lastEventAt: 1,
		lastEventType: "PreToolUse",
		...(ended ? { endedAt: 2 } : {}),
	};
}

function sources(overrides: Partial<HostMetricsSources> = {}) {
	let clock = 1_000;
	let cpuCalls = 0;
	const cpuSamples = [
		{ idle: 0, total: 0 },
		{ idle: 60, total: 100 },
		{ idle: 110, total: 200 },
	];
	const value: HostMetricsSources = {
		now: () => clock,
		cpuTimes: () =>
			cpuSamples[Math.min(cpuCalls++, cpuSamples.length - 1)] ?? {
				idle: 0,
				total: 0,
			},
		readMemory: async () => ({
			totalBytes: 20 * GIB,
			availableBytes: 9 * GIB,
			swap: null,
		}),
		readProcessTable: async () =>
			parseProcessTable(
				["10 1 1048576", "11 10 1048576", "20 1 524288"].join("\n"),
			),
		listSessions: async () => ({
			live: 3,
			sessions: [
				{ terminalId: "a", workspaceId: "small", pid: 20, title: null },
				{ terminalId: "b", workspaceId: "big", pid: 10, title: null },
			],
		}),
		workspaceLabels: (ids) => new Map(ids.map((id) => [id, `label-${id}`])),
		listAgents: () => [agent("a"), agent("b"), agent("c", true)],
		...overrides,
	};
	return {
		value,
		advance: (ms: number) => {
			clock += ms;
		},
	};
}

test("one sample: memory used from available, live agents, workspaces by memory", async () => {
	const { value } = sources();
	const metrics = await createHostMetricsCollector(value, {
		firstSampleDelayMs: 0,
	}).read();
	expect(metrics.cpu.usagePercent).toBe(40);
	expect(metrics.memory).toEqual({
		totalBytes: 20 * GIB,
		availableBytes: 9 * GIB,
		usedBytes: 11 * GIB,
	});
	expect(metrics.agents).toEqual({ active: 2, subagents: 0 });
	expect(metrics.terminals).toEqual({ live: 3 });
	expect(metrics.topWorkspaces).toEqual([
		{
			workspaceId: "big",
			label: "label-big",
			memoryBytes: 2 * GIB,
			terminals: 1,
		},
		{
			workspaceId: "small",
			label: "label-small",
			memoryBytes: 0.5 * GIB,
			terminals: 1,
		},
	]);
});

test("callers inside the cache window share a sample; CPU is the delta since the last one", async () => {
	const { value, advance } = sources();
	const collector = createHostMetricsCollector(value, {
		cacheMs: 1_000,
		firstSampleDelayMs: 0,
	});
	const first = await collector.read();
	expect(await collector.read()).toBe(first);
	advance(1_000);
	const second = await collector.read();
	expect(second).not.toBe(first);
	expect(second.cpu.usagePercent).toBe(50);
});

test("a dead terminal daemon still gives machine numbers", async () => {
	const { value } = sources({
		listSessions: async () => {
			throw new Error("daemon not running");
		},
	});
	const metrics = await createHostMetricsCollector(value, {
		firstSampleDelayMs: 0,
	}).read();
	expect(metrics.terminals).toBeNull();
	expect(metrics.topWorkspaces).toEqual([]);
	expect(metrics.memory.usedBytes).toBe(11 * GIB);
});
