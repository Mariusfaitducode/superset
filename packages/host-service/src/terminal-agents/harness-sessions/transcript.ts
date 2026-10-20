import type { AgentIdentityId } from "@superset/shared/agent-catalog";
import { isTrustedTranscriptPath } from "../transcript-path";
import { claudeSessionFiles } from "./claude";
import { codexSessionFiles } from "./codex";
import { fileHeadIncludes } from "./file-head";
import { isFile } from "./is-file";
import { toSessionQuery } from "./query";
import { readTurnsFromTail } from "./tail";
import type { HarnessSessionFiles, HarnessSessionRef } from "./types";

/**
 * Read a session back from the harness's own store when it keeps one.
 *
 * The PTY stream is the universal source, but it is a reconstruction: rows as
 * they were painted, capped by a retention ring, with tool output and UI
 * chrome interleaved. A harness that already writes its conversation to disk
 * has the same content structured, complete, and free of redraw artefacts, so
 * prefer it where it exists and fall back to the stream everywhere else.
 *
 * This module runs on a host worker thread (workers/tasks/harness.ts): a
 * session file can run to hundreds of megabytes, and reading and parsing it
 * must not stall the event loop.
 */
export const HARNESS_SESSION_FILES: Partial<
	Record<AgentIdentityId, HarnessSessionFiles>
> = {
	claude: claudeSessionFiles,
	codex: codexSessionFiles,
};

/**
 * How far into a reported file its session id must appear. Every Claude line
 * and Codex's opening session_meta carry it; this is generous for a first
 * line swollen by pasted content.
 */
const REPORTED_FILE_ID_WINDOW_BYTES = 1024 * 1024;

/**
 * The path the harness's own hook reported, when it is still a transcript
 * file of this session. It is exact however the harness lays out its store,
 * even under a name that is not the id. The hook endpoint is
 * unauthenticated, so the file must name the session itself before it is
 * read into another agent's prompt.
 */
function reportedSessionFile(
	reportedPath: string | null | undefined,
	sessionId: string,
): string | null {
	return reportedPath &&
		isTrustedTranscriptPath(reportedPath) &&
		isFile(reportedPath) &&
		fileHeadIncludes(reportedPath, sessionId, REPORTED_FILE_ID_WINDOW_BYTES)
		? reportedPath
		: null;
}

export interface HarnessTranscript {
	text: string;
	/** Which harness store answered, for the caller to report. */
	harness: string;
}

export interface LocatedHarnessSession {
	agentId: AgentIdentityId;
	files: HarnessSessionFiles;
	sessionId: string;
	path: string | null;
	reported: boolean;
}

/**
 * The session's file in its harness's store, trusting a reported path only
 * when it names the session. Null when the harness keeps no session files or
 * the ref carries no usable session id. Throws when the store is unreadable.
 */
export function locateHarnessSessionFile(
	ref: HarnessSessionRef,
): LocatedHarnessSession | null {
	const resolved = toSessionQuery(ref);
	const agentId = resolved?.agentId as AgentIdentityId | undefined;
	const files = agentId && HARNESS_SESSION_FILES[agentId];
	if (!resolved || !agentId || !files) return null;
	const { query } = resolved;
	const reported = reportedSessionFile(ref.reportedPath, query.sessionId);
	return {
		agentId,
		files,
		sessionId: query.sessionId,
		path: reported ?? files.locate(query),
		reported: reported !== null,
	};
}

/**
 * The harness's own transcript for a session, oldest turns dropped first
 * when it exceeds `maxChars`. Null when the harness keeps none, the session
 * is unknown, or the file cannot be read.
 */
export function readHarnessTranscript(
	ref: HarnessSessionRef,
	maxChars: number,
): HarnessTranscript | null {
	let located: LocatedHarnessSession | null;
	try {
		located = locateHarnessSessionFile(ref);
	} catch (error) {
		// An unreadable store must not fail the handoff; the stream answers.
		console.warn(
			`[harness-sessions] could not look up ${ref.agentId} session ${ref.sessionId}:`,
			error,
		);
		return null;
	}
	const parseTurns = located?.files.parseTurns;
	if (!located || !parseTurns) return null;
	const { path, sessionId } = located;
	if (!path) {
		// A bound session with no file anywhere means the harness moved its
		// store: the handoff silently degrades to the terminal's last moments.
		console.warn(
			`[harness-sessions] no transcript for ${ref.agentId} session ${sessionId}; falling back to the terminal stream`,
		);
		return null;
	}
	if (!located.reported) {
		console.info(
			`[harness-sessions] ${ref.agentId} session ${sessionId} found without a reported path`,
		);
	}
	const text = readTurnsFromTail(path, maxChars, parseTurns);
	return text ? { text, harness: ref.agentId ?? "" } : null;
}
