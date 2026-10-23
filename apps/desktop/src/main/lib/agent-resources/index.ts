import os from "node:os";
import path from "node:path";
import {
	captureSharedProcessSnapshot,
	enrichWithPhysFootprint,
	getSubtreeResources,
	type ProcessSnapshot,
} from "main/lib/resource-metrics/process-tree";
import {
	collectWorkspaceSessionMap,
	type ResourceMetricsSurface,
} from "main/lib/resource-metrics/session-sources";
import {
	type ClaudeSessionStatus,
	findAncestorIn,
	readLiveSessionFiles,
} from "./claude-sessions";
import { locateTranscript, readLastHumanMessageAt } from "./last-human-message";
import {
	type DockerVm,
	findDockerVmPids,
	type MemoryPressure,
	readDockerVm,
	readMachineMemory,
} from "./machine";
import {
	findOrphanRoots,
	killProcessTree,
	readLaunchdJobPids,
	readOrphanDetails,
} from "./orphans";

export interface AgentSessionRow {
	pid: number;
	sessionId: string;
	cwd: string;
	name: string | null;
	status: ClaudeSessionStatus;
	waitingFor: string | null;
	startedAt: number | null;
	lastHumanAt: number | null;
	cpu: number;
	memory: number;
	processCount: number;
	/** The Superset terminal the session runs in, when it runs in one. */
	terminalId: string | null;
	workspaceId: string | null;
}

export interface OrphanRow {
	pid: number;
	name: string;
	command: string;
	cwd: string | null;
	startedAt: number | null;
	cpu: number;
	memory: number;
	processCount: number;
}

export interface MachineRow {
	totalMemory: number;
	usedMemory: number;
	swapTotal: number;
	swapUsed: number;
	pressure: MemoryPressure | null;
	loadAverage1m: number;
	cpuCoreCount: number;
	docker: DockerVm;
}

export interface AgentResourcesSnapshot {
	machine: MachineRow;
	sessions: AgentSessionRow[];
	orphans: OrphanRow[];
	collectedAt: number;
	/** Wall time this collection took, so the view's own cost stays visible. */
	collectMs: number;
}

const PROCESS_SNAPSHOT_MAX_AGE_MS = 1_000;

export function getClaudeDir(): string {
	return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

async function mapTerminalShells({
	surface,
	organizationId,
}: {
	surface: ResourceMetricsSurface;
	organizationId?: string;
}): Promise<Map<number, { terminalId: string; workspaceId: string }>> {
	const shells = new Map<number, { terminalId: string; workspaceId: string }>();
	const workspaceSessionMap = await collectWorkspaceSessionMap({
		surface,
		organizationId,
	});
	for (const [workspaceId, entries] of workspaceSessionMap) {
		for (const entry of entries) {
			shells.set(entry.pid, { terminalId: entry.sessionId, workspaceId });
		}
	}
	return shells;
}

// Processes bundled inside an app (Superset's own daemons included) are the
// app's business, even when they run as node.
function isAppBundled(command: string): boolean {
	return command.includes(".app/Contents/");
}

async function collectOrphans(
	snapshot: ProcessSnapshot,
	claudePids: number[],
): Promise<OrphanRow[]> {
	const protectedPids = new Set([
		...claudePids,
		...(await readLaunchdJobPids()),
		process.pid,
	]);
	const roots = findOrphanRoots(snapshot, protectedPids);
	enrichWithPhysFootprint(
		snapshot,
		roots.flatMap((root) => root.pids),
	);
	const details = await readOrphanDetails(roots);
	const rows: OrphanRow[] = [];
	for (const root of roots) {
		const detail = details.get(root.pid);
		if (!detail || isAppBundled(detail.command)) continue;
		// Footprints replaced RSS above; re-sum the tree.
		const resources = getSubtreeResources(snapshot, root.pid);
		rows.push({
			pid: root.pid,
			name: root.name,
			command: detail.command,
			cwd: detail.cwd,
			startedAt: detail.startedAt,
			cpu: resources.cpu,
			memory: resources.memory,
			processCount: resources.pids.length,
		});
	}
	return rows.sort((a, b) => b.memory - a.memory);
}

export async function collectAgentResources(options: {
	surface: ResourceMetricsSurface;
	organizationId?: string;
}): Promise<AgentResourcesSnapshot> {
	const startedAt = performance.now();
	const claudeDir = getClaudeDir();
	const [snapshot, shells, memory] = await Promise.all([
		captureSharedProcessSnapshot(PROCESS_SNAPSHOT_MAX_AGE_MS),
		mapTerminalShells(options).catch(() => new Map()),
		readMachineMemory(),
	]);

	const files = await readLiveSessionFiles(claudeDir, snapshot);
	const dockerVmPids = findDockerVmPids(snapshot);
	enrichWithPhysFootprint(snapshot, [
		...files.flatMap((file) => getSubtreeResources(snapshot, file.pid).pids),
		...dockerVmPids,
	]);

	const sessions = await Promise.all(
		files.map(async (file): Promise<AgentSessionRow> => {
			const transcript = await locateTranscript(
				claudeDir,
				file.sessionId,
				file.cwd,
			);
			const resources = getSubtreeResources(snapshot, file.pid);
			const terminal = findAncestorIn(snapshot, file.pid, shells);
			return {
				pid: file.pid,
				sessionId: file.sessionId,
				cwd: file.cwd,
				name: file.name,
				status: file.status,
				waitingFor: file.waitingFor,
				startedAt: file.startedAt,
				lastHumanAt: transcript
					? await readLastHumanMessageAt(transcript)
					: null,
				cpu: resources.cpu,
				memory: resources.memory,
				processCount: resources.pids.length,
				terminalId: terminal?.terminalId ?? null,
				workspaceId: terminal?.workspaceId ?? null,
			};
		}),
	);

	const [orphans, docker] = await Promise.all([
		collectOrphans(
			snapshot,
			files.map((file) => file.pid),
		),
		readDockerVm(snapshot, dockerVmPids),
	]);

	const totalMemory = os.totalmem();
	return {
		machine: {
			totalMemory,
			usedMemory: Math.max(0, totalMemory - os.freemem()),
			swapTotal: memory.swapTotal,
			swapUsed: memory.swapUsed,
			pressure: memory.pressure,
			loadAverage1m: os.loadavg()[0] ?? 0,
			cpuCoreCount: Math.max(1, os.cpus().length),
			docker,
		},
		sessions,
		orphans,
		collectedAt: Date.now(),
		collectMs: performance.now() - startedAt,
	};
}

/**
 * SIGHUP is what an idle `claude` obeys (it ignores SIGTERM); it's also what
 * closing its terminal sends. Used for sessions outside Superset terminals.
 */
export async function hangUpClaudeSession(pid: number): Promise<boolean> {
	const snapshot = await captureSharedProcessSnapshot(0);
	const files = await readLiveSessionFiles(getClaudeDir(), snapshot);
	// Only pids that are live sessions: never an arbitrary process.
	if (!files.some((file) => file.pid === pid)) return false;
	try {
		process.kill(pid, "SIGHUP");
		return true;
	} catch {
		return false;
	}
}

/** Re-checks the pid is still an orphan root before killing its tree. */
export async function killOrphan(pid: number): Promise<boolean> {
	const snapshot = await captureSharedProcessSnapshot(0);
	const files = await readLiveSessionFiles(getClaudeDir(), snapshot);
	const orphans = await collectOrphans(
		snapshot,
		files.map((file) => file.pid),
	);
	if (!orphans.some((orphan) => orphan.pid === pid)) return false;
	await killProcessTree(snapshot, pid);
	return true;
}
