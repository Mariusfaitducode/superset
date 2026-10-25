import type { CpuInfo } from "node:os";

export interface CpuTimesSample {
	idle: number;
	total: number;
}

export function sumCpuTimes(cpus: ReadonlyArray<Pick<CpuInfo, "times">>) {
	let idle = 0;
	let total = 0;
	for (const { times } of cpus) {
		idle += times.idle;
		total += times.user + times.nice + times.sys + times.idle + times.irq;
	}
	return { idle, total } satisfies CpuTimesSample;
}

/** Busy share of all cores between two samples, 0–100; null without elapsed time. */
export function cpuBusyPercent(
	previous: CpuTimesSample,
	next: CpuTimesSample,
): number | null {
	const total = next.total - previous.total;
	const idle = next.idle - previous.idle;
	if (total <= 0) return null;
	const busy = Math.min(Math.max((total - idle) / total, 0), 1);
	return Math.round(busy * 1000) / 10;
}
