import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	getSubtreePids,
	getSubtreeResources,
	type ProcessSnapshot,
} from "main/lib/resource-metrics/process-tree";

const execFileAsync = promisify(execFile);

// What agents leave behind: dev servers, test browsers, scripts, encoders.
const DEV_PROCESS_NAMES = new Set([
	"node",
	"bun",
	"deno",
	"npm",
	"npx",
	"pnpm",
	"yarn",
	"vite",
	"esbuild",
	"tsx",
	"turbo",
	"next-server",
	"python",
	"python3",
	"Python",
	"uv",
	"uvicorn",
	"gunicorn",
	"pytest",
	"ffmpeg",
	"chrome-headless-shell",
	"Google Chrome for Testing",
	"Chromium",
]);
const SHELL_NAMES = new Set(["zsh", "bash", "sh", "fish"]);

function isDevProcess(name: string | undefined): boolean {
	return (
		name !== undefined &&
		(DEV_PROCESS_NAMES.has(name) || /^python3\.\d+$/.test(name))
	);
}

export interface OrphanRoot {
	pid: number;
	name: string;
	cpu: number;
	memory: number;
	pids: number[];
}

/**
 * A dev process is an orphan when nothing alive owns it anymore: every
 * ancestor up to launchd is another dev process or a shell. A live terminal,
 * app or agent in the chain means someone still owns it. `protectedPids`
 * covers what the chain can't tell apart: live agents that run as `node`, and
 * launchd jobs the user installed on purpose.
 *
 * Returns the topmost dev process of each orphaned chain, so killing it takes
 * the whole tree.
 */
export function findOrphanRoots(
	snapshot: ProcessSnapshot,
	protectedPids: Set<number>,
): OrphanRoot[] {
	const roots = new Map<number, OrphanRoot>();
	for (const info of snapshot.byPid.values()) {
		if (!isDevProcess(info.name)) continue;
		let topDev = info.pid;
		let current = info;
		let orphaned = false;
		while (true) {
			if (protectedPids.has(current.pid)) break;
			if (isDevProcess(current.name)) topDev = current.pid;
			else if (!SHELL_NAMES.has(current.name ?? "")) break;
			if (current.ppid === 1) {
				orphaned = true;
				break;
			}
			const parent = snapshot.byPid.get(current.ppid);
			if (!parent) break;
			current = parent;
		}
		if (!orphaned || roots.has(topDev)) continue;
		const resources = getSubtreeResources(snapshot, topDev);
		roots.set(topDev, {
			pid: topDev,
			name: snapshot.byPid.get(topDev)?.name ?? "",
			cpu: resources.cpu,
			memory: resources.memory,
			pids: resources.pids,
		});
	}
	return [...roots.values()];
}

let launchdJobsCache: { at: number; pids: Set<number> } | null = null;
const LAUNCHD_JOBS_MAX_AGE_MS = 30_000;

export function parseLaunchctlList(stdout: string): Set<number> {
	const pids = new Set<number>();
	for (const line of stdout.split("\n")) {
		const pid = Number.parseInt(line.split("\t")[0] ?? "", 10);
		if (Number.isInteger(pid) && pid > 0) pids.add(pid);
	}
	return pids;
}

/** Pids the user's launchd agents run on purpose: never orphans. */
export async function readLaunchdJobPids(): Promise<Set<number>> {
	if (
		launchdJobsCache &&
		Date.now() - launchdJobsCache.at < LAUNCHD_JOBS_MAX_AGE_MS
	) {
		return launchdJobsCache.pids;
	}
	try {
		const { stdout } = await execFileAsync("launchctl", ["list"], {
			timeout: 2_000,
		});
		launchdJobsCache = { at: Date.now(), pids: parseLaunchctlList(stdout) };
	} catch {
		launchdJobsCache = { at: Date.now(), pids: new Set() };
	}
	return launchdJobsCache.pids;
}

export interface OrphanDetails {
	command: string;
	cwd: string | null;
	startedAt: number | null;
}

const detailsCache = new Map<string, OrphanDetails>();

/**
 * Command line, cwd and start time, for the few orphan roots only: one `ps`
 * and one `lsof` for all of them, cached per pid.
 */
export async function readOrphanDetails(
	roots: OrphanRoot[],
): Promise<Map<number, OrphanDetails>> {
	const result = new Map<number, OrphanDetails>();
	const missing = roots.filter((root) => {
		const cached = detailsCache.get(`${root.pid}:${root.name}`);
		if (cached) result.set(root.pid, cached);
		return !cached;
	});
	if (missing.length === 0) return result;
	const pidList = missing.map((root) => root.pid).join(",");

	const commands = new Map<number, { command: string; startedAt: number }>();
	try {
		const { stdout } = await execFileAsync(
			"ps",
			["-o", "pid=,lstart=,args=", "-p", pidList],
			{ timeout: 2_000 },
		);
		for (const line of stdout.split("\n")) {
			// lstart is a fixed 24-char date: "Wed Oct 21 19:13:12 2026".
			const match =
				/^\s*(\d+)\s+(\w{3} \w{3}\s+\d+ [\d:]{8} \d{4})\s+(.*)$/.exec(line);
			if (!match) continue;
			commands.set(Number.parseInt(match[1], 10), {
				startedAt: Date.parse(match[2]),
				command: match[3],
			});
		}
	} catch {
		// Processes may have exited since the snapshot.
	}

	const cwds = new Map<number, string>();
	try {
		const { stdout } = await execFileAsync(
			"lsof",
			["-a", "-d", "cwd", "-Fpn", "-p", pidList],
			{ timeout: 2_000 },
		);
		let pid = 0;
		for (const line of stdout.split("\n")) {
			if (line.startsWith("p")) pid = Number.parseInt(line.slice(1), 10);
			if (line.startsWith("n") && pid) cwds.set(pid, line.slice(1));
		}
	} catch {
		// lsof exits non-zero when one pid is gone; what it printed still counts.
	}

	for (const root of missing) {
		const command = commands.get(root.pid);
		if (!command) continue;
		const details: OrphanDetails = {
			command: command.command,
			cwd: cwds.get(root.pid) ?? null,
			startedAt: Number.isFinite(command.startedAt) ? command.startedAt : null,
		};
		detailsCache.set(`${root.pid}:${root.name}`, details);
		result.set(root.pid, details);
	}
	return result;
}

const KILL_GRACE_MS = 3_000;

function signalAll(pids: number[], signal: NodeJS.Signals): number[] {
	const signalled: number[] = [];
	for (const pid of pids) {
		try {
			process.kill(pid, signal);
			signalled.push(pid);
		} catch {
			// Already gone.
		}
	}
	return signalled;
}

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** SIGTERM the whole tree, then SIGKILL whatever is left after a grace period. */
export async function killProcessTree(
	snapshot: ProcessSnapshot,
	rootPid: number,
	graceMs = KILL_GRACE_MS,
): Promise<void> {
	const pids = getSubtreePids(snapshot, rootPid);
	const signalled = signalAll(pids, "SIGTERM");
	await new Promise((resolve) => setTimeout(resolve, graceMs));
	signalAll(signalled.filter(isAlive), "SIGKILL");
}
