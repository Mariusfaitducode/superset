import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ProcessSnapshot } from "main/lib/resource-metrics/process-tree";

const execFileAsync = promisify(execFile);

export type MemoryPressure = "normal" | "warn" | "critical";

export interface MachineMemory {
	swapTotal: number;
	swapUsed: number;
	pressure: MemoryPressure | null;
}

export interface DockerVm {
	/** What Docker Desktop is allowed to give its VM, from its settings. */
	memoryLimit: number | null;
	/** What the VM process holds right now; null when Docker isn't running. */
	memoryUsed: number | null;
}

const UNIT_BYTES: Record<string, number> = {
	K: 1024,
	M: 1024 ** 2,
	G: 1024 ** 3,
};

function parseSysctlSize(value: string): number {
	const match = /^([\d.]+)([KMG])$/.exec(value);
	if (!match) return 0;
	return Number.parseFloat(match[1]) * (UNIT_BYTES[match[2]] ?? 1);
}

// kern.memorystatus_vm_pressure_level: 1 normal, 2 warn, 4 critical.
const PRESSURE_LEVELS: Record<string, MemoryPressure> = {
	"1": "normal",
	"2": "warn",
	"4": "critical",
};

/** Parses `sysctl -n vm.swapusage kern.memorystatus_vm_pressure_level`. */
export function parseSysctlMemory(stdout: string): MachineMemory {
	const [swapLine = "", pressureLine = ""] = stdout.split("\n");
	const total = /total = (\S+)/.exec(swapLine)?.[1];
	const used = /used = (\S+)/.exec(swapLine)?.[1];
	return {
		swapTotal: total ? parseSysctlSize(total) : 0,
		swapUsed: used ? parseSysctlSize(used) : 0,
		pressure: PRESSURE_LEVELS[pressureLine.trim()] ?? null,
	};
}

export async function readMachineMemory(): Promise<MachineMemory> {
	if (os.platform() !== "darwin") {
		return { swapTotal: 0, swapUsed: 0, pressure: null };
	}
	try {
		const { stdout } = await execFileAsync(
			"sysctl",
			["-n", "vm.swapusage", "kern.memorystatus_vm_pressure_level"],
			{ timeout: 2_000 },
		);
		return parseSysctlMemory(stdout);
	} catch {
		return { swapTotal: 0, swapUsed: 0, pressure: null };
	}
}

const DOCKER_SETTINGS_FILES = ["settings-store.json", "settings.json"].map(
	(file) =>
		path.join(os.homedir(), "Library/Group Containers/group.com.docker", file),
);

let dockerLimitCache: { mtimeMs: number; limit: number | null } | null = null;

export function parseDockerMemoryLimit(settingsJson: string): number | null {
	try {
		const settings = JSON.parse(settingsJson) as Record<string, unknown>;
		const mib = settings.MemoryMiB ?? settings.memoryMiB;
		return typeof mib === "number" && mib > 0 ? mib * 1024 * 1024 : null;
	} catch {
		return null;
	}
}

async function readDockerMemoryLimit(): Promise<number | null> {
	for (const file of DOCKER_SETTINGS_FILES) {
		try {
			const { mtimeMs } = await stat(file);
			if (dockerLimitCache?.mtimeMs === mtimeMs) return dockerLimitCache.limit;
			const limit = parseDockerMemoryLimit(await readFile(file, "utf8"));
			dockerLimitCache = { mtimeMs, limit };
			return limit;
		} catch {
			// Try the next settings file name.
		}
	}
	return null;
}

const DOCKER_BACKEND_NAMES = new Set([
	"com.docker.backend",
	"com.docker.virtualization",
]);
const VM_PROCESS_NAME = "com.apple.Virtualization.VirtualMachine";

/**
 * Docker Desktop runs its Linux VM in Apple's Virtualization framework, as an
 * XPC service rather than a child of Docker. Other apps can use the same
 * service, so it only counts while Docker's own processes are up.
 */
export function findDockerVmPids(snapshot: ProcessSnapshot): number[] {
	let dockerRunning = false;
	const vmPids: number[] = [];
	for (const info of snapshot.byPid.values()) {
		if (info.name && DOCKER_BACKEND_NAMES.has(info.name)) dockerRunning = true;
		if (info.name === VM_PROCESS_NAME) vmPids.push(info.pid);
	}
	return dockerRunning ? vmPids : [];
}

export async function readDockerVm(
	snapshot: ProcessSnapshot,
	vmPids: number[],
): Promise<DockerVm> {
	const memoryLimit = await readDockerMemoryLimit();
	if (vmPids.length === 0) return { memoryLimit, memoryUsed: null };
	let memoryUsed = 0;
	for (const pid of vmPids) {
		memoryUsed += snapshot.byPid.get(pid)?.memory ?? 0;
	}
	return { memoryLimit, memoryUsed };
}
