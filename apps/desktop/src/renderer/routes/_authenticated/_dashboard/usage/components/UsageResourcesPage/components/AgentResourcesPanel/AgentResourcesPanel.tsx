import type {
	AgentResourcesSnapshot,
	AgentSessionView,
	ClosedSessionEntry,
	OrphanRow,
} from "../../types";
import { AgentSessionsTable } from "../AgentSessionsTable";
import { ClosedSessionsList } from "../ClosedSessionsList";
import { MachineHeader } from "../MachineHeader";
import { OrphansTable } from "../OrphansTable";

/** Everything about agents on the Resources page, fed by props only. */
export function AgentResourcesPanel({
	snapshot,
	sessions,
	closedSessions,
	isClosing,
	killingPid,
	resumingSessionId,
	onCloseSessions,
	onOpenSession,
	onKillOrphan,
	onResume,
}: {
	snapshot: AgentResourcesSnapshot;
	sessions: AgentSessionView[];
	closedSessions: ClosedSessionEntry[];
	isClosing: boolean;
	killingPid: number | null;
	resumingSessionId: string | null;
	onCloseSessions: (sessions: AgentSessionView[]) => void;
	onOpenSession: (session: AgentSessionView) => void;
	onKillOrphan: (orphan: OrphanRow) => void;
	onResume: (entry: ClosedSessionEntry) => void;
}) {
	const now = snapshot.collectedAt;
	return (
		<div className="flex flex-col gap-3">
			<MachineHeader
				machine={snapshot.machine}
				agentsMemory={sessions.reduce((sum, s) => sum + s.memory, 0)}
				collectMs={snapshot.collectMs}
			/>
			<AgentSessionsTable
				sessions={sessions}
				now={now}
				isClosing={isClosing}
				onClose={onCloseSessions}
				onOpen={onOpenSession}
			/>
			<OrphansTable
				orphans={snapshot.orphans}
				now={now}
				killingPid={killingPid}
				onKill={onKillOrphan}
			/>
			<ClosedSessionsList
				entries={closedSessions}
				now={now}
				resumingSessionId={resumingSessionId}
				onResume={onResume}
			/>
		</div>
	);
}
