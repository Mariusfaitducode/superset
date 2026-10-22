import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ProcessSnapshot } from "main/lib/resource-metrics/process-tree";

export type ClaudeSessionStatus =
	| "idle"
	| "busy"
	| "shell"
	| "waiting"
	| "unknown";

/** One `~/.claude/sessions/<pid>.json` file, written by each live CLI. */
export interface ClaudeSessionFile {
	pid: number;
	sessionId: string;
	cwd: string;
	name: string | null;
	status: ClaudeSessionStatus;
	/** What a `waiting` session waits for, e.g. "permission prompt". */
	waitingFor: string | null;
	startedAt: number | null;
	updatedAt: number | null;
}

const KNOWN_STATUSES = new Set<ClaudeSessionStatus>([
	"idle",
	"busy",
	"shell",
	"waiting",
]);

export function parseSessionFile(json: string): ClaudeSessionFile | null {
	let raw: Record<string, unknown>;
	try {
		raw = JSON.parse(json);
	} catch {
		return null;
	}
	if (
		typeof raw.pid !== "number" ||
		typeof raw.sessionId !== "string" ||
		typeof raw.cwd !== "string"
	) {
		return null;
	}
	const status = raw.status as ClaudeSessionStatus;
	return {
		pid: raw.pid,
		sessionId: raw.sessionId,
		cwd: raw.cwd,
		name: typeof raw.name === "string" ? raw.name : null,
		status: KNOWN_STATUSES.has(status) ? status : "unknown",
		waitingFor: typeof raw.waitingFor === "string" ? raw.waitingFor : null,
		startedAt: typeof raw.startedAt === "number" ? raw.startedAt : null,
		updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null,
	};
}

// Native installs run as `claude`; npm installs run under node or bun.
const CLAUDE_PROCESS_NAMES = new Set(["claude", "node", "bun"]);

/**
 * Session files outlive crashed CLIs, and pids get reused: a file only counts
 * while its pid is alive and still looks like the CLI.
 */
export function isLiveClaudeProcess(
	snapshot: ProcessSnapshot,
	pid: number,
): boolean {
	const name = snapshot.byPid.get(pid)?.name;
	return name !== undefined && CLAUDE_PROCESS_NAMES.has(name);
}

export async function readLiveSessionFiles(
	claudeDir: string,
	snapshot: ProcessSnapshot,
): Promise<ClaudeSessionFile[]> {
	const sessionsDir = path.join(claudeDir, "sessions");
	let names: string[];
	try {
		names = await readdir(sessionsDir);
	} catch {
		return [];
	}
	const files = await Promise.all(
		names
			.filter((name) => /^\d+\.json$/.test(name))
			.filter((name) =>
				isLiveClaudeProcess(snapshot, Number.parseInt(name, 10)),
			)
			.map(async (name) => {
				try {
					return parseSessionFile(
						await readFile(path.join(sessionsDir, name), "utf8"),
					);
				} catch {
					return null;
				}
			}),
	);
	return files.filter((file): file is ClaudeSessionFile => file !== null);
}

/** First ancestor of `pid` (itself included) found in `targets`. */
export function findAncestorIn<T>(
	snapshot: ProcessSnapshot,
	pid: number,
	targets: Map<number, T>,
): T | null {
	const seen = new Set<number>();
	let current: number | undefined = pid;
	while (current !== undefined && current > 1 && !seen.has(current)) {
		seen.add(current);
		const target = targets.get(current);
		if (target !== undefined) return target;
		current = snapshot.byPid.get(current)?.ppid;
	}
	return null;
}
