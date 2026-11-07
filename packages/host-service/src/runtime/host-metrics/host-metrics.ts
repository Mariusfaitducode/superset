import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import { inArray } from "drizzle-orm";
import type { HostDb } from "../../db/index.ts";
import { workspaces } from "../../db/schema.ts";
import { getDaemonClient } from "../../terminal/daemon-client-singleton.ts";
import {
	listTerminalResourceSessions,
	type TerminalResourceSession,
} from "../../terminal/resource-sessions.ts";
import type { TerminalAgentBinding } from "../../terminal-agents/types.ts";
import { type CpuTimesSample, cpuBusyPercent, sumCpuTimes } from "./cpu.ts";
import {
	type MemoryReading,
	parseMeminfo,
	parseSwapUsage,
	parseVmStatAvailableBytes,
} from "./memory.ts";
import {
	type ProcessTable,
	parseProcessTable,
	subtreeRssBytes,
} from "./process-table.ts";

const execFileAsync = promisify(execFile);

const TOP_WORKSPACE_COUNT = 5;
const EXEC_TIMEOUT_MS = 3_000;
const EXEC_MAX_BUFFER = 8 * 1024 * 1024;

export interface HostMetricsWorkspace {
	workspaceId: string;
	label: string | null;
	memoryBytes: number;
}

export interface HostMetrics {
	sampledAt: number;
	cpu: {
		/** Busy share of all cores since the previous sample, 0–100. */
		usagePercent: number | null;
	};
	memory: { totalBytes: number; usedBytes: number; availableBytes: number };
	swap: { totalBytes: number; usedBytes: number } | null;
	/** Agents whose session has not ended. */
	agents: number;
	/** Workspaces by terminal memory (process subtree RSS), largest first. */
	topWorkspaces: HostMetricsWorkspace[];
}

export interface HostMetricsSources {
	now(): number;
	cpuTimes(): CpuTimesSample;
	readMemory(): Promise<MemoryReading>;
	readProcessTable(): Promise<ProcessTable | null>;
	listSessions(): Promise<TerminalResourceSession[]>;
	workspaceLabels(ids: string[]): Map<string, string>;
	listAgents(): TerminalAgentBinding[];
}

export interface HostMetricsCollectorOptions {
	/** Requests inside this window share one sample. */
	cacheMs?: number;
	/** The very first CPU reading needs a second sample this much later. */
	firstSampleDelayMs?: number;
}

export function createHostMetricsCollector(
	sources: HostMetricsSources,
	{
		cacheMs = 2_000,
		firstSampleDelayMs = 250,
	}: HostMetricsCollectorOptions = {},
) {
	let previousCpu: CpuTimesSample | null = null;
	let cached: { at: number; value: Promise<HostMetrics> } | null = null;

	async function readCpuPercent(): Promise<number | null> {
		if (!previousCpu) {
			previousCpu = sources.cpuTimes();
			await new Promise((resolve) => setTimeout(resolve, firstSampleDelayMs));
		}
		const next = sources.cpuTimes();
		const percent = cpuBusyPercent(previousCpu, next);
		previousCpu = next;
		return percent;
	}

	async function sample(): Promise<HostMetrics> {
		const [usagePercent, memory, processTable, sessions] = await Promise.all([
			readCpuPercent(),
			sources.readMemory(),
			sources.readProcessTable().catch(() => null),
			sources.listSessions().catch(() => null),
		]);
		return {
			sampledAt: sources.now(),
			cpu: { usagePercent },
			memory: {
				totalBytes: memory.totalBytes,
				availableBytes: memory.availableBytes,
				usedBytes: Math.max(0, memory.totalBytes - memory.availableBytes),
			},
			swap: memory.swap,
			agents: sources.listAgents().filter((agent) => !agent.endedAt).length,
			topWorkspaces: sessions
				? rankWorkspaces(sessions, processTable, sources)
				: [],
		};
	}

	return {
		read(): Promise<HostMetrics> {
			const now = sources.now();
			if (cached && now - cached.at < cacheMs) return cached.value;
			const value = sample();
			cached = { at: now, value };
			value.catch(() => {
				if (cached?.value === value) cached = null;
			});
			return value;
		},
	};
}

function rankWorkspaces(
	sessions: TerminalResourceSession[],
	processTable: ProcessTable | null,
	sources: Pick<HostMetricsSources, "workspaceLabels">,
): HostMetricsWorkspace[] {
	const byWorkspace = new Map<string, number>();
	for (const session of sessions) {
		const memoryBytes = processTable
			? subtreeRssBytes(processTable, session.pid)
			: 0;
		byWorkspace.set(
			session.workspaceId,
			(byWorkspace.get(session.workspaceId) ?? 0) + memoryBytes,
		);
	}
	const ranked = [...byWorkspace.entries()]
		.sort(([, a], [, b]) => b - a)
		.slice(0, TOP_WORKSPACE_COUNT);
	const labels = sources.workspaceLabels(ranked.map(([id]) => id));
	return ranked.map(([workspaceId, memoryBytes]) => ({
		workspaceId,
		label: labels.get(workspaceId) ?? null,
		memoryBytes,
	}));
}

async function readSystemMemory(): Promise<MemoryReading> {
	const totalBytes = os.totalmem();
	if (os.platform() === "linux") {
		const parsed = await readFile("/proc/meminfo", "utf8")
			.then(parseMeminfo)
			.catch(() => null);
		if (parsed) return parsed;
	}
	if (os.platform() === "darwin") {
		const [available, swap] = await Promise.all([
			execFileAsync("vm_stat", [], { timeout: EXEC_TIMEOUT_MS })
				.then(({ stdout }) => parseVmStatAvailableBytes(stdout))
				.catch(() => null),
			execFileAsync("sysctl", ["-n", "vm.swapusage"], {
				timeout: EXEC_TIMEOUT_MS,
			})
				.then(({ stdout }) => parseSwapUsage(stdout))
				.catch(() => null),
		]);
		if (available !== null) {
			return {
				totalBytes,
				availableBytes: Math.min(available, totalBytes),
				swap,
			};
		}
	}
	return { totalBytes, availableBytes: os.freemem(), swap: null };
}

async function readSystemProcessTable(): Promise<ProcessTable | null> {
	if (os.platform() === "win32") return null;
	const { stdout } = await execFileAsync(
		"ps",
		["-A", "-o", "pid=,ppid=,rss="],
		{
			timeout: EXEC_TIMEOUT_MS,
			maxBuffer: EXEC_MAX_BUFFER,
		},
	);
	return parseProcessTable(stdout);
}

let collector: ReturnType<typeof createHostMetricsCollector> | null = null;
let collectorDb: HostDb | null = null;
let currentAgents: () => TerminalAgentBinding[] = () => [];

export function readHostMetrics(args: {
	db: HostDb;
	listAgents: () => TerminalAgentBinding[];
}): Promise<HostMetrics> {
	currentAgents = args.listAgents;
	if (!collector || collectorDb !== args.db) {
		const db = args.db;
		collectorDb = db;
		collector = createHostMetricsCollector({
			now: Date.now,
			cpuTimes: () => sumCpuTimes(os.cpus()),
			readMemory: readSystemMemory,
			readProcessTable: readSystemProcessTable,
			listSessions: async () =>
				listTerminalResourceSessions(
					db,
					await (await getDaemonClient()).list(),
				),
			workspaceLabels: (ids) => {
				if (ids.length === 0) return new Map();
				const rows = db
					.select({
						id: workspaces.id,
						name: workspaces.name,
						branch: workspaces.branch,
					})
					.from(workspaces)
					.where(inArray(workspaces.id, ids))
					.all();
				return new Map(rows.map((row) => [row.id, row.name || row.branch]));
			},
			listAgents: () => currentAgents(),
		});
	}
	return collector.read();
}
