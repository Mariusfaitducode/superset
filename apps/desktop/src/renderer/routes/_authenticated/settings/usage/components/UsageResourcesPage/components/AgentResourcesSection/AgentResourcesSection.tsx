import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { useMemo } from "react";
import type { ResourceMetricsSnapshot } from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/types";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";
import {
	type ResumeTarget,
	useAgentResources,
} from "../../hooks/useAgentResources";
import type { AgentSessionView } from "../../types";
import { buildSessionViews } from "../../utils/buildSessionViews";
import { AgentResourcesPanel } from "../AgentResourcesPanel";

/** Wires the agents panel to the main process and the host service. */
export function AgentResourcesSection({
	surface,
	resources,
	onOpenTerminal,
}: {
	surface: "v1" | "v2";
	/** The resource tree's snapshot: it knows pane titles and workspace names. */
	resources: ResourceMetricsSnapshot | null;
	onOpenTerminal: (workspaceId: string, terminalId: string) => void;
}) {
	const { t } = useLingui();
	const { activeHostUrl } = useLocalHostService();
	const agent = useAgentResources({ surface, hostUrl: activeHostUrl });
	const snapshot = agent.snapshot;
	const sessions = useMemo(
		() => buildSessionViews(snapshot?.sessions ?? [], resources),
		[snapshot, resources],
	);

	const resume = (target: ResumeTarget) => {
		agent.resumeSession.mutate(target, {
			onSuccess: ({ workspaceId, terminalId }) =>
				onOpenTerminal(workspaceId, terminalId),
			onError: () =>
				toast.error(t({ message: "Could not resume the session" })),
		});
	};

	const closeSessions = (toClose: AgentSessionView[]) => {
		agent.closeSessions.mutate(toClose, {
			onSuccess: ({ closed, failed }) => {
				if (failed > 0) {
					toast.error(
						t({
							message: plural(failed, {
								one: "# session could not be closed",
								other: "# sessions could not be closed",
							}),
						}),
					);
				}
				if (closed === 0) return;
				const [single] = toClose;
				// Undo for one session only: resuming a dozen at once would
				// cost more memory than the cleanup freed.
				const undoTarget =
					toClose.length === 1 && single?.workspaceId
						? {
								sessionId: single.sessionId,
								cwd: single.cwd,
								workspaceId: single.workspaceId,
							}
						: null;
				const title = single?.title ?? "";
				toast.success(
					toClose.length === 1
						? t({ message: `Closed ${title}` })
						: t({
								message: plural(closed, {
									one: "Closed # session",
									other: "Closed # sessions",
								}),
							}),
					undoTarget
						? {
								action: {
									label: t({ message: "Undo" }),
									onClick: () => resume(undoTarget),
								},
							}
						: {
								description: t({
									message: "Resume them from “Recently closed”",
								}),
							},
				);
			},
		});
	};

	if (!snapshot) {
		return (
			<div className="rounded-lg border px-3 py-6 text-center text-xs text-muted-foreground">
				<Trans>Looking for agents…</Trans>
			</div>
		);
	}

	return (
		<AgentResourcesPanel
			snapshot={snapshot}
			sessions={sessions}
			closedSessions={agent.closedSessions}
			isClosing={agent.closeSessions.isPending}
			killingPid={
				agent.killOrphan.isPending
					? (agent.killOrphan.variables?.pid ?? null)
					: null
			}
			resumingSessionId={
				agent.resumeSession.isPending
					? (agent.resumeSession.variables?.sessionId ?? null)
					: null
			}
			onCloseSessions={closeSessions}
			onOpenSession={(session) => {
				if (session.workspaceId && session.terminalId) {
					onOpenTerminal(session.workspaceId, session.terminalId);
				}
			}}
			onKillOrphan={(orphan) =>
				agent.killOrphan.mutate(
					{ pid: orphan.pid },
					{
						onSuccess: (killed) => {
							if (!killed) {
								toast.error(
									t({
										message:
											"Not killed: the process is gone or no longer an orphan",
									}),
								);
							}
						},
					},
				)
			}
			onResume={(entry) => {
				if (entry.workspaceId) {
					resume({
						sessionId: entry.sessionId,
						cwd: entry.cwd,
						workspaceId: entry.workspaceId,
					});
				}
			}}
		/>
	);
}
