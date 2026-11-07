import type { HostMetrics } from "./fetchHostMetrics";

/** Same scale as the local machine's verdict in Settings › Resources. */
export type HostVerdict = "room" | "tight" | "critical";

// Memory decides: agents are memory-bound, and a 5 s CPU spike from a build
// says little about room for one more.
const MEMORY_TIGHT_SHARE = 0.75;
const MEMORY_CRITICAL_SHARE = 0.9;
const SWAP_TIGHT_SHARE = 0.75;
const CPU_TIGHT_SHARE = 0.9;

const GIB = 1024 ** 3;

export interface HostLoad {
	/** 0–1, null until the host has two CPU samples. */
	cpu: number | null;
	memory: number;
	swap: number | null;
}

function share(used: number, total: number): number {
	if (total <= 0) return 0;
	return Math.min(Math.max(used / total, 0), 1);
}

export function getHostLoad(metrics: HostMetrics): HostLoad {
	return {
		cpu:
			metrics.cpu.usagePercent === null ? null : metrics.cpu.usagePercent / 100,
		memory: share(metrics.memory.usedBytes, metrics.memory.totalBytes),
		swap: metrics.swap
			? share(metrics.swap.usedBytes, metrics.swap.totalBytes)
			: null,
	};
}

/** Can the host take another agent right now? */
export function getHostVerdict(load: HostLoad): HostVerdict {
	if (load.memory >= MEMORY_CRITICAL_SHARE) return "critical";
	if (
		load.memory >= MEMORY_TIGHT_SHARE ||
		(load.swap ?? 0) >= SWAP_TIGHT_SHARE ||
		(load.cpu ?? 0) >= CPU_TIGHT_SHARE
	) {
		return "tight";
	}
	return "room";
}

const VERDICT_RANK: Record<HostVerdict, number> = {
	room: 0,
	tight: 1,
	critical: 2,
};

export function worstVerdict(verdicts: HostVerdict[]): HostVerdict | null {
	return verdicts.reduce<HostVerdict | null>(
		(worst, verdict) =>
			worst === null || VERDICT_RANK[verdict] > VERDICT_RANK[worst]
				? verdict
				: worst,
		null,
	);
}

export function toGigabytes(bytes: number): number {
	return bytes / GIB;
}
