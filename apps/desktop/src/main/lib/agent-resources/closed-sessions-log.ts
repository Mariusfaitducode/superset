import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface ClosedSessionEntry {
	sessionId: string;
	cwd: string;
	title: string | null;
	/** Where to reopen it; null for a session that ran outside Superset. */
	workspaceId: string | null;
	closedAt: number;
	resumeCommand: string;
}

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildResumeCommand(cwd: string, sessionId: string): string {
	return `cd ${shellQuote(cwd)} && claude --resume ${sessionId}`;
}

export function closedSessionsLogPath(supersetHomeDir: string): string {
	return path.join(supersetHomeDir, "state", "closed-agent-sessions.jsonl");
}

export async function appendClosedSessions(
	logPath: string,
	entries: ClosedSessionEntry[],
): Promise<void> {
	if (entries.length === 0) return;
	await mkdir(path.dirname(logPath), { recursive: true });
	await appendFile(
		logPath,
		entries.map((entry) => `${JSON.stringify(entry)}\n`).join(""),
		"utf8",
	);
}

/** Most recent first. */
export async function readClosedSessions(
	logPath: string,
	limit: number,
): Promise<ClosedSessionEntry[]> {
	let text: string;
	try {
		text = await readFile(logPath, "utf8");
	} catch {
		return [];
	}
	const entries: ClosedSessionEntry[] = [];
	const lines = text.split("\n");
	for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
		if (!lines[i]) continue;
		try {
			entries.push(JSON.parse(lines[i]));
		} catch {
			// Skip a torn line.
		}
	}
	return entries;
}
