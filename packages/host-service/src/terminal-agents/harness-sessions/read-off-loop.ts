import { stat } from "node:fs/promises";
import { getHostWorkerPool } from "../../workers/host-worker-pool";
import {
	harnessSessionStatsTask,
	harnessTranscriptTask,
} from "../../workers/tasks/harness";
import { type SessionStats, toSessionStats } from "./stats";
import type { SessionStatsCursor } from "./stats/types";
import type { HarnessTranscript } from "./transcript";
import type { HarnessSessionRef } from "./types";

/**
 * `readHarnessTranscript` on a host worker. A failure answers null so the
 * handoff falls back to the terminal stream rather than failing the dialog.
 */
export async function readHarnessTranscriptOffLoop(
	ref: HarnessSessionRef,
	maxChars: number,
): Promise<HarnessTranscript | null> {
	try {
		return await getHostWorkerPool().run(harnessTranscriptTask, {
			ref,
			maxChars,
		});
	} catch (error) {
		console.warn(
			`[harness-sessions] reading ${ref.agentId} session ${ref.sessionId} failed:`,
			error,
		);
		return null;
	}
}

const MAX_STATS_CURSORS = 200;
const statsCursors = new Map<string, SessionStatsCursor>();

async function isUnchanged(cursor: SessionStatsCursor): Promise<boolean> {
	try {
		const { size, mtimeMs } = await stat(cursor.path);
		return size === cursor.size && mtimeMs === cursor.mtimeMs;
	} catch {
		return false;
	}
}

function remember(key: string, cursor: SessionStatsCursor | null): void {
	statsCursors.delete(key);
	if (!cursor) return;
	statsCursors.set(key, cursor);
	if (statsCursors.size > MAX_STATS_CURSORS) {
		const oldest = statsCursors.keys().next().value;
		if (oldest !== undefined) statsCursors.delete(oldest);
	}
}

/**
 * A session's token and context stats, read on a host worker. Each session
 * keeps where its last read stopped, so a poll costs a `stat` while the file
 * is unchanged and reads only the appended lines once it grows.
 */
export async function readHarnessSessionStatsOffLoop(
	ref: HarnessSessionRef,
): Promise<SessionStats | null> {
	const key = `${ref.agentId}:${ref.sessionId}`;
	const previous = statsCursors.get(key) ?? null;
	if (previous && (await isUnchanged(previous))) {
		return toSessionStats(previous.state);
	}
	try {
		const cursor = await getHostWorkerPool().run(harnessSessionStatsTask, {
			ref,
			previous,
		});
		remember(key, cursor);
		return cursor ? toSessionStats(cursor.state) : null;
	} catch (error) {
		console.warn(
			`[harness-sessions] reading stats for ${ref.agentId} session ${ref.sessionId} failed:`,
			error,
		);
		return null;
	}
}
