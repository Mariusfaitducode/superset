import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { MAX_LINE_LENGTH } from "../../../trpc/router/usage/history/parse";
import { locateHarnessSessionFile } from "../transcript";
import type { HarnessSessionRef } from "../types";
import {
	emptySessionStats,
	isSessionStatsAgent,
	sessionStatsReader,
} from "./index";
import type { SessionStatsCursor } from "./types";

const NEWLINE = 0x0a;

/**
 * Feeds every complete line in `[start, end)` to `onLine` and answers the
 * byte offset just past the last one, so a line still being written is read
 * again next time.
 */
export async function readCompleteLines(
	path: string,
	start: number,
	end: number,
	onLine: (line: string) => void,
): Promise<number> {
	if (end <= start) return start;
	let position = start;
	let consumed = start;
	let carry: Buffer[] = [];
	let carryLength = 0;
	let skipping = false;
	const stream = createReadStream(path, { start, end: end - 1 });
	for await (const chunk of stream as AsyncIterable<Buffer>) {
		let lineStart = 0;
		for (
			let newline = chunk.indexOf(NEWLINE);
			newline !== -1;
			newline = chunk.indexOf(NEWLINE, lineStart)
		) {
			if (!skipping) {
				const piece = chunk.subarray(lineStart, newline);
				const text = (
					carryLength > 0 ? Buffer.concat([...carry, piece]) : piece
				).toString("utf8");
				onLine(text.endsWith("\r") ? text.slice(0, -1) : text);
			}
			skipping = false;
			carry = [];
			carryLength = 0;
			lineStart = newline + 1;
			consumed = position + lineStart;
		}
		if (!skipping && lineStart < chunk.length) {
			carry.push(chunk.subarray(lineStart));
			carryLength += chunk.length - lineStart;
			if (carryLength > MAX_LINE_LENGTH) {
				carry = [];
				carryLength = 0;
				skipping = true;
			}
		}
		position += chunk.length;
	}
	return consumed;
}

/**
 * The session's stats, read on from `previous` when it is the same file and
 * only grew. Null when the harness is not one we read stats from or keeps no
 * file for the session. Runs on a host worker.
 */
export async function readHarnessSessionStats(
	ref: HarnessSessionRef,
	previous: SessionStatsCursor | null,
): Promise<SessionStatsCursor | null> {
	const located = locateHarnessSessionFile(ref);
	if (!located?.path || !isSessionStatsAgent(located.agentId)) return null;
	const { path, agentId } = located;
	const { size, mtimeMs } = await stat(path);
	const resumable =
		previous?.path === path &&
		previous.state.agent === agentId &&
		size >= previous.offset;
	const state = resumable
		? structuredClone(previous.state)
		: emptySessionStats(agentId);
	const start = resumable ? previous.offset : 0;
	const reader = sessionStatsReader(state);
	const offset = await readCompleteLines(path, start, size, reader.onLine);
	return { path, size, mtimeMs, offset, state: reader.finish() };
}
