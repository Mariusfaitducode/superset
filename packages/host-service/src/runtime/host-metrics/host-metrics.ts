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
	terminals: number;
}

export interface HostMetrics {
	sampledAt: number;
	hostname: string;
	platform: NodeJS.Platform;
	arch: string;
	release: string;
	uptimeSeconds: number;
	cpu: {
		cores: number;
		model: string | null;
		/** Busy share of all cores since the previous sample, 0–100. */
		usagePercent: number | null;
		loadAverage: [number, number, number];
	};
	memory: { totalBytes: number; usedBytes: number; availableBytes: number };
	swap: { totalBytes: number; usedBytes: number } | null;
	agents: { active: number; subagents: number };
	/** Null when the terminal daemon did not answer. */
	terminals: { live: number } | null;
	/** Workspaces by terminal memory (process subtree RSS), largest first. */
	topWorkspaces: HostMetricsWorkspace[];
}

export interface HostMetricsSources {
	now(): number;
	cpuTimes(): CpuTimesSample;
	readMemory(): Promise<MemoryReading>;
	readProcessTable(): Promise<ProcessTable | null>;
	listSessions(): Promise<{
		live: number;
		sessions: TerminalResourceSession[];
	} | null>;
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
		const agents = sources.listAgents().filter((agent) => !agent.endedAt);
		const cpus = os.cpus();
		const [load1 = 0, load5 = 0, load15 = 0] = os.loadavg();
		return {
			sampledAt: sources.now(),
			hostname: os.hostname(),
			platform: os.platform(),
			arch: os.arch(),
			release: os.release(),
			uptimeSeconds: Math.round(os.uptime()),
			cpu: {
				cores: cpus.length,
				model: cpus[0]?.model.trim() || null,
				usagePercent,
				loadAverage: [load1, load5, load15],
			},
			memory: {
				totalBytes: memory.totalBytes,
				availableBytes: memory.availableBytes,
				usedBytes: Math.max(0, memory.totalBytes - memory.availableBytes),
			},
			swap: memory.swap,
			agents: {
				active: agents.length,
				subagents: agents.reduce(
					(count, agent) => count + (agent.subagents?.length ?? 0),
					0,
				),
			},
			terminals: sessions ? { live: sessions.live } : null,
			topWorkspaces: sessions
				? rankWorkspaces(sessions.sessions, processTable, sources)
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
	const byWorkspace = new Map<
		string,
		{ memoryBytes: number; terminals: number }
	>();
	for (const session of sessions) {
		const entry = byWorkspace.get(session.workspaceId) ?? {
			memoryBytes: 0,
			terminals: 0,
		};
		entry.terminals += 1;
		if (processTable)
			entry.memoryBytes += subtreeRssBytes(processTable, session.pid);
		byWorkspace.set(session.workspaceId, entry);
	}
	const ranked = [...byWorkspace.entries()]
		.sort(
			([, a], [, b]) =>
				b.memoryBytes - a.memoryBytes || b.terminals - a.terminals,
		)
		.slice(0, TOP_WORKSPACE_COUNT);
	const labels = sources.workspaceLabels(ranked.map(([id]) => id));
	return ranked.map(([workspaceId, entry]) => ({
		workspaceId,
		label: labels.get(workspaceId) ?? null,
		...entry,
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
		const available = await execFileAsync("vm_stat", [], {
			timeout: EXEC_TIMEOUT_MS,
		})
			.then(({ stdout }) => parseVmStatAvailableBytes(stdout))
			.catch(() => null);
		if (available !== null) {
			return {
				totalBytes,
				availableBytes: Math.min(available, totalBytes),
				swap: null,
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
			listSessions: async () => {
				const daemonSessions = await (await getDaemonClient()).list();
				return {
					live: daemonSessions.filter((session) => session.alive).length,
					sessions: listTerminalResourceSessions(db, daemonSessions),
				};
			},
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
