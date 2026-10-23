import { type FileHandle, open, readdir, stat } from "node:fs/promises";
import path from "node:path";

// Entries that land in the transcript as `type: "user"` without the user
// having typed anything. Recent Claude Code versions tag real input with
// `origin.kind: "human"`; these prefixes cover transcripts written before.
const NON_HUMAN_PREFIXES = [
	"<task-notification>",
	"<command-name>",
	"<command-message>",
	"<local-command-stdout>",
	"<local-command-stderr>",
	"<local-command-caveat>",
	"<system-reminder>",
	"<cross-session-message",
	"<agent-message",
	"Caveat:",
	"[Request interrupted",
];

interface TranscriptEntry {
	type?: unknown;
	isMeta?: unknown;
	isSidechain?: unknown;
	toolUseResult?: unknown;
	origin?: { kind?: unknown };
	timestamp?: unknown;
	message?: { content?: unknown };
}

export function isHumanEntry(entry: TranscriptEntry): boolean {
	if (entry.type !== "user" || entry.isMeta || entry.isSidechain) return false;
	if (entry.toolUseResult !== undefined) return false;
	if (entry.origin && typeof entry.origin.kind === "string") {
		return entry.origin.kind === "human";
	}
	const content = entry.message?.content;
	if (typeof content === "string") {
		const text = content.trimStart();
		return (
			text.length > 0 &&
			!NON_HUMAN_PREFIXES.some((prefix) => text.startsWith(prefix))
		);
	}
	if (!Array.isArray(content)) return false;
	let hasText = false;
	for (const part of content) {
		const type = (part as { type?: unknown } | null)?.type;
		if (type === "tool_result") return false;
		if (type === "text") {
			const text = String((part as { text?: unknown }).text ?? "").trimStart();
			if (NON_HUMAN_PREFIXES.some((prefix) => text.startsWith(prefix))) {
				return false;
			}
			hasText = true;
		}
		if (type === "image") hasText = true;
	}
	return hasText;
}

/** Timestamp of the last human entry among JSONL lines, or null. */
export function findLastHumanTimestamp(lines: string[]): number | null {
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		// Cheap filter before parsing: most lines are assistant or tool output.
		if (!line.includes('"type":"user"')) continue;
		let entry: TranscriptEntry;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}
		if (!isHumanEntry(entry)) continue;
		const at =
			typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : NaN;
		if (Number.isFinite(at)) return at;
	}
	return null;
}

const CHUNK_BYTES = 256 * 1024;

/**
 * Scan `[start, end)` of the file backwards, chunk by chunk, so a 60 MB
 * transcript costs one chunk when the user wrote recently.
 */
async function scanBackwards(
	file: FileHandle,
	start: number,
	end: number,
): Promise<number | null> {
	let position = end;
	let carry = "";
	while (position > start) {
		const length = Math.min(CHUNK_BYTES, position - start);
		position -= length;
		const buffer = Buffer.alloc(length);
		await file.read(buffer, 0, length, position);
		const text = buffer.toString("utf8") + carry;
		const lines = text.split("\n");
		// The first line may continue in the previous chunk, unless we reached
		// the start of the range.
		carry = position > start ? (lines.shift() ?? "") : "";
		const found = findLastHumanTimestamp(lines);
		if (found !== null) return found;
	}
	return null;
}

interface CacheEntry {
	mtimeMs: number;
	/** Offset just past the last complete line already scanned. */
	scannedUpTo: number;
	lastHumanAt: number | null;
}

const cache = new Map<string, CacheEntry>();

async function lastNewlineOffset(
	file: FileHandle,
	size: number,
): Promise<number> {
	const length = Math.min(CHUNK_BYTES, size);
	const buffer = Buffer.alloc(length);
	await file.read(buffer, 0, length, size - length);
	const index = buffer.lastIndexOf(0x0a);
	return index === -1 ? size - length : size - length + index + 1;
}

/**
 * When did the user last write in this transcript? Re-reads only what was
 * appended since the previous call.
 */
export async function readLastHumanMessageAt(
	transcriptPath: string,
): Promise<number | null> {
	let file: FileHandle | null = null;
	try {
		const { size, mtimeMs } = await stat(transcriptPath);
		const cached = cache.get(transcriptPath);
		if (cached?.mtimeMs === mtimeMs) return cached.lastHumanAt;

		file = await open(transcriptPath, "r");
		const end = await lastNewlineOffset(file, size);
		const appendOnly = cached && cached.scannedUpTo <= end;
		const start = appendOnly ? cached.scannedUpTo : 0;
		const found = await scanBackwards(file, start, end);
		const lastHumanAt = found ?? (appendOnly ? cached.lastHumanAt : null);
		cache.set(transcriptPath, { mtimeMs, scannedUpTo: end, lastHumanAt });
		return lastHumanAt;
	} catch {
		return null;
	} finally {
		await file?.close();
	}
}

/** Claude Code names a project folder after its cwd, every other char → "-". */
export function claudeProjectDirName(cwd: string): string {
	return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

const transcriptPathCache = new Map<string, string>();
const missingSince = new Map<string, number>();
const MISSING_RETRY_MS = 30_000;

async function exists(file: string): Promise<boolean> {
	try {
		await stat(file);
		return true;
	} catch {
		return false;
	}
}

/**
 * The folder is usually derived from the cwd; long cwds get a hashed name, so
 * fall back to a scan of every project folder, at most every 30 s while the
 * session has written nothing yet.
 */
export async function locateTranscript(
	claudeDir: string,
	sessionId: string,
	cwd: string,
): Promise<string | null> {
	const known = transcriptPathCache.get(sessionId);
	if (known) return known;
	const projectsDir = path.join(claudeDir, "projects");
	const fileName = `${sessionId}.jsonl`;
	const direct = path.join(projectsDir, claudeProjectDirName(cwd), fileName);
	if (await exists(direct)) {
		transcriptPathCache.set(sessionId, direct);
		return direct;
	}
	const lastMiss = missingSince.get(sessionId);
	if (lastMiss !== undefined && Date.now() - lastMiss < MISSING_RETRY_MS) {
		return null;
	}
	missingSince.set(sessionId, Date.now());
	try {
		for (const dir of await readdir(projectsDir)) {
			const candidate = path.join(projectsDir, dir, fileName);
			if (await exists(candidate)) {
				transcriptPathCache.set(sessionId, candidate);
				return candidate;
			}
		}
	} catch {
		// No projects folder yet.
	}
	return null;
}
