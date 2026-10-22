import type { AgentSessionRow } from "../../types";

const HOUR_MS = 60 * 60 * 1000;

/** A session the user never wrote to counts from when it started. */
export function getLastAnsweredAt(session: AgentSessionRow): number | null {
	return session.lastHumanAt ?? session.startedAt;
}

/**
 * Sessions the user hasn't answered for more than `hours`. Only `idle` ones:
 * a session that is working, running a shell or waiting on a prompt is never
 * closed in bulk.
 */
export function selectStaleSessions<T extends AgentSessionRow>(
	sessions: T[],
	hours: number,
	now: number,
): T[] {
	return sessions
		.filter((session) => {
			if (session.status !== "idle") return false;
			const answeredAt = getLastAnsweredAt(session);
			return answeredAt !== null && now - answeredAt > hours * HOUR_MS;
		})
		.sort((a, b) => (getLastAnsweredAt(a) ?? 0) - (getLastAnsweredAt(b) ?? 0));
}
