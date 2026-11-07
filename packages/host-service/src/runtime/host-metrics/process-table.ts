export interface ProcessTable {
	rssBytesByPid: Map<number, number>;
	childrenByPid: Map<number, number[]>;
}

/** Parses `ps -A -o pid=,ppid=,rss=` (RSS in KiB on Linux and macOS). */
export function parseProcessTable(stdout: string): ProcessTable {
	const rssBytesByPid = new Map<number, number>();
	const childrenByPid = new Map<number, number[]>();
	for (const line of stdout.split("\n")) {
		const [pid, ppid, rss] = line.trim().split(/\s+/).map(Number);
		if (
			pid === undefined ||
			ppid === undefined ||
			rss === undefined ||
			!Number.isInteger(pid) ||
			!Number.isInteger(ppid) ||
			!Number.isFinite(rss)
		) {
			continue;
		}
		rssBytesByPid.set(pid, rss * 1024);
		const siblings = childrenByPid.get(ppid);
		if (siblings) siblings.push(pid);
		else childrenByPid.set(ppid, [pid]);
	}
	return { rssBytesByPid, childrenByPid };
}

export function subtreeRssBytes(table: ProcessTable, rootPid: number): number {
	let bytes = 0;
	const stack = [rootPid];
	const visited = new Set<number>();
	while (stack.length > 0) {
		const pid = stack.pop() as number;
		if (visited.has(pid)) continue;
		visited.add(pid);
		bytes += table.rssBytesByPid.get(pid) ?? 0;
		for (const child of table.childrenByPid.get(pid) ?? []) stack.push(child);
	}
	return bytes;
}
