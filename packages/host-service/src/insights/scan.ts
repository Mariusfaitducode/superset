import { createReadStream, type Dirent } from "node:fs";
import {
	mkdir,
	readdir,
	readFile,
	rename,
	stat,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { type InsightEvent, parseTranscriptLine } from "./classify";

export const RETENTION_DAYS = 84;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What one transcript file has given so far, and where to resume reading it. */
export interface TranscriptFileEntry {
	sessionId: string;
	/** Bytes consumed, always at a line end: a line still being written is read next time. */
	offset: number;
	mtimeMs: number;
	entrypoint: string | null;
	cwdCounts: Record<string, number>;
	events: InsightEvent[];
}

export interface TranscriptCache {
	version: 1;
	files: Record<string, TranscriptFileEntry>;
}

export function defaultClaudeProjectsDir(): string {
	return join(homedir(), ".claude", "projects");
}

export function defaultInsightsCachePath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "insights-cache.json");
}

function emptyCache(): TranscriptCache {
	return { version: 1, files: {} };
}

export async function loadTranscriptCache(
	path: string,
): Promise<TranscriptCache> {
	try {
		const parsed = JSON.parse(await readFile(path, "utf-8"));
		return parsed?.version === 1 && parsed.files ? parsed : emptyCache();
	} catch {
		return emptyCache();
	}
}

export async function saveTranscriptCache(
	path: string,
	cache: TranscriptCache,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temp = `${path}.${process.pid}.tmp`;
	await writeFile(temp, JSON.stringify(cache));
	await rename(temp, path);
}

interface FoundFile {
	path: string;
	size: number;
	mtimeMs: number;
}

/**
 * Top-level session files only (`<project>/<session>.jsonl`). Subagent
 * transcripts sit one level deeper and never hold a message the user typed.
 */
async function listSessionFiles(
	root: string,
	cutoffMs: number,
): Promise<FoundFile[]> {
	let projects: Dirent[];
	try {
		projects = await readdir(root, { withFileTypes: true });
	} catch {
		return [];
	}
	const found: FoundFile[] = [];
	for (const project of projects) {
		if (!project.isDirectory()) continue;
		const dir = join(root, project.name);
		let entries: Dirent[];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
			const path = join(dir, entry.name);
			try {
				const info = await stat(path);
				if (info.mtimeMs >= cutoffMs) {
					found.push({ path, size: info.size, mtimeMs: info.mtimeMs });
				}
			} catch {
				// Removed while listing.
			}
		}
	}
	return found;
}

const NEWLINE = 0x0a;
const RELEVANT_TYPES = [
	'"type":"user"',
	'"type":"assistant"',
	'"type":"system"',
];

async function readFrom(
	entry: TranscriptFileEntry,
	path: string,
	cutoffMs: number,
): Promise<void> {
	let pending: Buffer = Buffer.alloc(0);
	const stream = createReadStream(path, { start: entry.offset });
	for await (const chunk of stream as AsyncIterable<Buffer>) {
		pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
		let start = 0;
		let end = pending.indexOf(NEWLINE, start);
		while (end !== -1) {
			const raw = pending.toString("utf-8", start, end);
			entry.offset += end - start + 1;
			start = end + 1;
			end = pending.indexOf(NEWLINE, start);
			if (!RELEVANT_TYPES.some((type) => raw.includes(type))) continue;
			const parsed = parseTranscriptLine(raw);
			if (!parsed || parsed.event[0] < cutoffMs) continue;
			entry.events.push(parsed.event);
			entry.entrypoint ??= parsed.entrypoint;
			if (parsed.cwd) {
				entry.cwdCounts[parsed.cwd] = (entry.cwdCounts[parsed.cwd] ?? 0) + 1;
			}
		}
		pending = pending.subarray(start);
	}
}

export interface ScanOptions {
	root?: string;
	cachePath?: string;
	nowMs?: number;
	/** Stop reading new bytes after this long; the next scan picks up where this one stopped. */
	budgetMs?: number;
}

export interface ScanResult {
	cache: TranscriptCache;
	/** False when the budget ran out before every file was read to its end. */
	complete: boolean;
}

/**
 * Brings the cache up to date with the transcripts on disk, reading only the
 * bytes appended since the last scan. A file that shrank was rewritten, so
 * it is read again from the start.
 */
export async function scanTranscripts(
	options: ScanOptions = {},
): Promise<ScanResult> {
	const root = options.root ?? defaultClaudeProjectsDir();
	const cachePath = options.cachePath ?? defaultInsightsCachePath();
	const nowMs = options.nowMs ?? Date.now();
	const deadline = Date.now() + (options.budgetMs ?? 60_000);
	const cutoffMs = nowMs - RETENTION_DAYS * DAY_MS;

	const cache = await loadTranscriptCache(cachePath);
	const found = await listSessionFiles(root, cutoffMs);
	const present = new Set(found.map((file) => file.path));
	let changed = false;
	for (const path of Object.keys(cache.files)) {
		if (present.has(path)) continue;
		delete cache.files[path];
		changed = true;
	}

	let complete = true;
	// Smallest first: a budget cut leaves most sessions complete.
	found.sort((a, b) => a.size - b.size);
	for (const file of found) {
		let entry = cache.files[file.path];
		if (entry && entry.offset === file.size && entry.mtimeMs === file.mtimeMs) {
			continue;
		}
		if (Date.now() > deadline) {
			complete = false;
			break;
		}
		if (!entry || file.size < entry.offset) {
			entry = {
				sessionId: basename(file.path, ".jsonl"),
				offset: 0,
				mtimeMs: file.mtimeMs,
				entrypoint: null,
				cwdCounts: {},
				events: [],
			};
			cache.files[file.path] = entry;
		}
		try {
			await readFrom(entry, file.path, cutoffMs);
		} catch {
			// Unreadable now; the offset kept so far stays valid.
		}
		entry.mtimeMs = file.mtimeMs;
		entry.events = entry.events.filter((event) => event[0] >= cutoffMs);
		changed = true;
	}

	if (changed) {
		await saveTranscriptCache(cachePath, cache);
	}
	return { cache, complete };
}
