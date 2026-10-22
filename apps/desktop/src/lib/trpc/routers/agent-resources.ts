import {
	collectAgentResources,
	hangUpClaudeSession,
	killOrphan,
} from "main/lib/agent-resources";
import {
	appendClosedSessions,
	buildResumeCommand,
	closedSessionsLogPath,
	readClosedSessions,
} from "main/lib/agent-resources/closed-sessions-log";
import { SUPERSET_HOME_DIR } from "main/lib/app-environment";
import { z } from "zod";
import { publicProcedure, router } from "..";

const CLOSED_SESSIONS_SHOWN = 30;

export const createAgentResourcesRouter = () => {
	const logPath = closedSessionsLogPath(SUPERSET_HOME_DIR);

	return router({
		getSnapshot: publicProcedure
			.input(
				z.object({
					surface: z.enum(["v1", "v2"]),
					organizationId: z.string().optional(),
				}),
			)
			.query(({ input }) => collectAgentResources(input)),

		closedSessions: publicProcedure.query(() =>
			readClosedSessions(logPath, CLOSED_SESSIONS_SHOWN),
		),

		/** Written before the session is closed, so a failed close still leaves a way back. */
		recordClosedSessions: publicProcedure
			.input(
				z.array(
					z.object({
						sessionId: z.string(),
						cwd: z.string(),
						title: z.string().nullable(),
						workspaceId: z.string().nullable(),
					}),
				),
			)
			.mutation(({ input }) => {
				const closedAt = Date.now();
				return appendClosedSessions(
					logPath,
					input.map((session) => ({
						...session,
						closedAt,
						resumeCommand: buildResumeCommand(session.cwd, session.sessionId),
					})),
				);
			}),

		hangUpSession: publicProcedure
			.input(z.object({ pid: z.number().int().positive() }))
			.mutation(({ input }) => hangUpClaudeSession(input.pid)),

		killOrphan: publicProcedure
			.input(z.object({ pid: z.number().int().positive() }))
			.mutation(({ input }) => killOrphan(input.pid)),
	});
};
