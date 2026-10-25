export interface MemoryReading {
	totalBytes: number;
	availableBytes: number;
	swap: { totalBytes: number; usedBytes: number } | null;
}

const KIB = 1024;

/**
 * Reads `/proc/meminfo`. `MemAvailable` counts reclaimable page cache, so it
 * is what "free" means to a user; `os.freemem()` reads `MemFree` and makes a
 * Linux box with a warm cache look full.
 */
export function parseMeminfo(text: string): MemoryReading | null {
	const fields = new Map<string, number>();
	for (const line of text.split("\n")) {
		const match = /^(\w+):\s+(\d+)(?:\s+kB)?/.exec(line);
		if (match?.[1] && match[2]) fields.set(match[1], Number(match[2]) * KIB);
	}
	const totalBytes = fields.get("MemTotal");
	if (!totalBytes) return null;
	const availableBytes =
		fields.get("MemAvailable") ??
		(fields.get("MemFree") ?? 0) +
			(fields.get("Buffers") ?? 0) +
			(fields.get("Cached") ?? 0);
	const swapTotal = fields.get("SwapTotal") ?? 0;
	const swapFree = fields.get("SwapFree") ?? 0;
	return {
		totalBytes,
		availableBytes: Math.min(availableBytes, totalBytes),
		swap:
			swapTotal > 0
				? {
						totalBytes: swapTotal,
						usedBytes: Math.max(0, swapTotal - swapFree),
					}
				: null,
	};
}

/**
 * Reads macOS `vm_stat`. Free, inactive and speculative pages are what the
 * kernel gives back on demand, close to Activity Monitor's view.
 */
export function parseVmStatAvailableBytes(text: string): number | null {
	const pageSize = /page size of (\d+) bytes/.exec(text)?.[1];
	if (!pageSize) return null;
	let pages = 0;
	let found = false;
	for (const key of ["Pages free", "Pages inactive", "Pages speculative"]) {
		const match = new RegExp(`^${key}:\\s+(\\d+)`, "m").exec(text);
		if (match?.[1]) {
			pages += Number(match[1]);
			found = true;
		}
	}
	return found ? pages * Number(pageSize) : null;
}
