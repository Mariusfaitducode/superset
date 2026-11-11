import type { ElectronRouterOutputs } from "renderer/lib/electron-trpc";

export type AgentResourcesSnapshot =
	ElectronRouterOutputs["agentResources"]["getSnapshot"];
export type AgentSessionRow = AgentResourcesSnapshot["sessions"][number];
export type OrphanRow = AgentResourcesSnapshot["orphans"][number];
export type ClosedSessionEntry =
	ElectronRouterOutputs["agentResources"]["closedSessions"][number];

/** A session row with the names the renderer knows (pane title, workspace). */
export interface AgentSessionView extends AgentSessionRow {
	title: string;
	workspaceLabel: string;
}
