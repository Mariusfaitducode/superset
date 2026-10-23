import type { MessageDescriptor } from "@lingui/core";
import { msg, plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { i18n } from "@superset/i18n";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { cn } from "@superset/ui/utils";
import { useState } from "react";
import { HiOutlineBarsArrowDown } from "react-icons/hi2";
import { formatMemory } from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/utils/formatters";
import {
	type AgentSortOption,
	useAgentCleanupStore,
} from "../../stores/agentCleanup";
import type { AgentSessionView } from "../../types";
import { selectStaleSessions } from "../../utils/selectStaleSessions";
import { sortAgentSessions } from "../../utils/sortAgentSessions";
import { AgentSessionRow, ROW_GRID } from "./components/AgentSessionRow";
import { CleanupBar } from "./components/CleanupBar";
import { CloseSessionsDialog } from "./components/CloseSessionsDialog";

const SORT_LABELS: Record<AgentSortOption, MessageDescriptor> = {
	"last-reply": msg({ message: "My last message" }),
	memory: msg({ message: "Memory" }),
	name: msg({ message: "Name" }),
};

export function AgentSessionsTable({
	sessions,
	now,
	isClosing,
	onClose,
	onOpen,
}: {
	sessions: AgentSessionView[];
	now: number;
	isClosing: boolean;
	/** Closes right away; this component confirms first when it should. */
	onClose: (sessions: AgentSessionView[]) => void;
	onOpen: (session: AgentSessionView) => void;
}) {
	const { t } = useLingui();
	const { thresholdHours, setThresholdHours, sortBy, setSortBy } =
		useAgentCleanupStore();
	const [pendingClose, setPendingClose] = useState<AgentSessionView[] | null>(
		null,
	);

	const stale = selectStaleSessions(sessions, thresholdHours, now);
	const staleIds = new Set(stale.map((session) => session.sessionId));
	const sorted = sortAgentSessions(sessions, sortBy);
	const totalMemory = sessions.reduce((sum, s) => sum + s.memory, 0);
	const maxMemory = Math.max(0, ...sessions.map((s) => s.memory));
	const sessionCount = sessions.length;
	const total = formatMemory(totalMemory);

	return (
		<section className="overflow-hidden rounded-lg border">
			<header className="flex items-center gap-2 px-3 py-2">
				<h3 className="text-[13px] font-medium">
					<Trans>Agents</Trans>
				</h3>
				<span className="text-[12px] text-muted-foreground tabular-nums">
					{t({
						message: plural(sessionCount, {
							one: `# session · ${total}`,
							other: `# sessions · ${total}`,
						}),
					})}
				</span>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="ml-auto flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
							aria-label={t({ message: "Sort agents" })}
						>
							<HiOutlineBarsArrowDown className="h-3.5 w-3.5" />
							<span>{i18n._(SORT_LABELS[sortBy])}</span>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-44">
						<DropdownMenuRadioGroup
							value={sortBy}
							onValueChange={(value) => setSortBy(value as AgentSortOption)}
						>
							<DropdownMenuRadioItem value="last-reply">
								<Trans>My last message</Trans>
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="memory">
								<Trans>Memory</Trans>
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="name">
								<Trans>Name</Trans>
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</header>

			<CleanupBar
				thresholdHours={thresholdHours}
				onThresholdChange={setThresholdHours}
				candidates={stale}
				disabled={isClosing}
				onCleanUp={() => setPendingClose(stale)}
			/>

			{sessions.length > 0 && (
				<div
					className={cn(
						ROW_GRID,
						"border-b px-3 py-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground",
					)}
				>
					<span>
						<Trans>Session</Trans>
					</span>
					<span className="text-right">
						<Trans>My last msg</Trans>
					</span>
					<span className="text-right">
						<Trans>CPU</Trans>
					</span>
					<span className="text-right">
						<Trans>Memory</Trans>
					</span>
					<span />
				</div>
			)}

			{sorted.map((session) => (
				<AgentSessionRow
					key={session.sessionId}
					session={session}
					now={now}
					isStale={staleIds.has(session.sessionId)}
					maxMemory={maxMemory}
					disabled={isClosing}
					onOpen={() => onOpen(session)}
					onClose={() =>
						session.status === "idle"
							? onClose([session])
							: setPendingClose([session])
					}
				/>
			))}

			{sessions.length === 0 && (
				<div className="px-3 py-6 text-center text-xs text-muted-foreground">
					<Trans>No agent running</Trans>
				</div>
			)}

			<CloseSessionsDialog
				sessions={pendingClose}
				now={now}
				onCancel={() => setPendingClose(null)}
				onConfirm={(toClose) => {
					setPendingClose(null);
					onClose(toClose);
				}}
			/>
		</section>
	);
}
