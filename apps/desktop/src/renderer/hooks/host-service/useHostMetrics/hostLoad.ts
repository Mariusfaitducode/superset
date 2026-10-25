import type { HostMetrics } from "./fetchHostMetrics";

/** Shares at or above this read as a machine under pressure. */
export const HOST_LOAD_HOT_SHARE = 0.85;

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

export function isHotShare(value: number | null): boolean {
	return value !== null && value >= HOST_LOAD_HOT_SHARE;
}

export function isHostHot(load: HostLoad): boolean {
	return isHotShare(load.cpu) || isHotShare(load.memory);
}

export function toGigabytes(bytes: number): number {
	return bytes / GIB;
}
