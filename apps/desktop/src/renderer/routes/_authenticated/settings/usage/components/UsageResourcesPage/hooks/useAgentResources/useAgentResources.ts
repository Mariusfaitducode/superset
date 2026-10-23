import { useMutation } from "@tanstack/react-query";
import { useActiveOrganizationId } from "renderer/hooks/useActiveOrganizationId";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { getResourceMonitorRefetchInterval } from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/resourceConsumptionPolicy";
import type { AgentSessionView } from "../../types";
import { closeTerminal } from "../../utils/closeTerminal";

const SESSION_ID_PATTERN = /^[0-9a-f-]{8,64}$/i;

export interface ResumeTarget {
	sessionId: string;
	cwd: string;
	workspaceId: string;
}

export interface CloseSessionsResult {
	closed: number;
	failed: number;
}

/**
 * Polls the agent sessions, orphans and machine memory while the page is
 * mounted; closes and resumes sessions, kills orphans.
 */
export function useAgentResources({
	surface,
	hostUrl,
}: {
	surface: "v1" | "v2";
	hostUrl: string | null;
}) {
	const organizationId = useActiveOrganizationId() ?? undefined;
	const utils = electronTrpc.useUtils();

	const snapshotQuery = electronTrpc.agentResources.getSnapshot.useQuery(
		{ surface, organizationId },
		{ refetchInterval: getResourceMonitorRefetchInterval(true) },
	);
	const closedSessionsQuery =
		electronTrpc.agentResources.closedSessions.useQuery();

	const recordClosed =
		electronTrpc.agentResources.recordClosedSessions.useMutation();
	const hangUp = electronTrpc.agentResources.hangUpSession.useMutation();

	const closeSessions = useMutation({
		mutationFn: async (
			sessions: AgentSessionView[],
		): Promise<CloseSessionsResult> => {
			await recordClosed.mutateAsync(
				sessions.map((session) => ({
					sessionId: session.sessionId,
					cwd: session.cwd,
					title: session.title,
					workspaceId: session.workspaceId,
				})),
			);
			let closed = 0;
			// One at a time: concurrent layout edits on one workspace race.
			for (const session of sessions) {
				try {
					if (session.terminalId && session.workspaceId && hostUrl) {
						await closeTerminal(
							getHostServiceClientByUrl(hostUrl),
							session.workspaceId,
							session.terminalId,
						);
					} else if (!(await hangUp.mutateAsync({ pid: session.pid }))) {
						continue;
					}
					closed++;
				} catch {
					// Counted as failed below; the resume line is already logged.
				}
			}
			return { closed, failed: sessions.length - closed };
		},
		onSettled: () => {
			void utils.agentResources.getSnapshot.invalidate();
			void utils.agentResources.closedSessions.invalidate();
		},
	});

	/** A new terminal in the session's workspace, running `claude --resume`. */
	const resumeSession = useMutation({
		mutationFn: async (target: ResumeTarget) => {
			if (!hostUrl) throw new Error("No host connection.");
			// It goes into a shell command line.
			if (!SESSION_ID_PATTERN.test(target.sessionId)) {
				throw new Error("Not a Claude session id.");
			}
			const { terminalId } = await getHostServiceClientByUrl(
				hostUrl,
			).terminal.createSession.mutate({
				workspaceId: target.workspaceId,
				cwd: target.cwd,
				initialCommand: `claude --resume ${target.sessionId}`,
			});
			return { workspaceId: target.workspaceId, terminalId };
		},
		onSettled: () => {
			void utils.agentResources.getSnapshot.invalidate();
		},
	});

	const killOrphan = electronTrpc.agentResources.killOrphan.useMutation({
		onSettled: () => {
			void utils.agentResources.getSnapshot.invalidate();
		},
	});

	return {
		snapshot: snapshotQuery.data ?? null,
		closedSessions: closedSessionsQuery.data ?? [],
		closeSessions,
		resumeSession,
		killOrphan,
	};
}
