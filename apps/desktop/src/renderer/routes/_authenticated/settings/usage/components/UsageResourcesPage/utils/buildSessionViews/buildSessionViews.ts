import type { ResourceMetricsSnapshot } from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/types";
import type { AgentSessionRow, AgentSessionView } from "../../types";

function basename(cwd: string): string {
	return cwd.split("/").filter(Boolean).pop() ?? cwd;
}

/**
 * Names a session the way the sidebar does: the pane's title (renamed or set
 * by the agent) and its workspace, both of which only the renderer knows.
 * Falls back on Claude's own session name and the cwd.
 */
export function buildSessionViews(
	sessions: AgentSessionRow[],
	resources: ResourceMetricsSnapshot | null,
): AgentSessionView[] {
	const terminalTitles = new Map<string, string>();
	const workspaceLabels = new Map<string, string>();
	for (const workspace of resources?.workspaces ?? []) {
		workspaceLabels.set(
			workspace.workspaceId,
			`${workspace.projectName} / ${workspace.workspaceName}`,
		);
		for (const session of workspace.sessions) {
			if (session.title) terminalTitles.set(session.sessionId, session.title);
		}
	}
	return sessions.map((session) => ({
		...session,
		title:
			(session.terminalId && terminalTitles.get(session.terminalId)) ||
			session.name ||
			session.sessionId.slice(0, 8),
		workspaceLabel:
			(session.workspaceId && workspaceLabels.get(session.workspaceId)) ||
			basename(session.cwd),
	}));
}
