import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { formatAge } from "@superset/i18n/format";
import { Button } from "@superset/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import { HiMiniXMark } from "react-icons/hi2";
import { LuArrowUpRight } from "react-icons/lu";
import {
	formatCpu,
	formatMemory,
} from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/utils/formatters";
import type { AgentSessionView } from "../../../../types";
import { getLastAnsweredAt } from "../../../../utils/selectStaleSessions";

export const ROW_GRID =
	"grid grid-cols-[minmax(0,1fr)_5.5rem_4rem_6.5rem_3.5rem] items-center gap-3";

const STATUS_DOT: Record<AgentSessionView["status"], string> = {
	idle: "bg-muted-foreground/40",
	busy: "bg-emerald-500 animate-pulse",
	shell: "bg-sky-500",
	waiting: "bg-amber-500",
	unknown: "bg-muted-foreground/20",
};

function useStatusLabel(session: AgentSessionView): string | null {
	const { t } = useLingui();
	const waitingFor = session.waitingFor;
	switch (session.status) {
		case "busy":
			return t({ message: "Working" });
		case "shell":
			return t({ message: "Running a command" });
		case "waiting":
			return waitingFor
				? t({ message: `Waiting for you · ${waitingFor}` })
				: t({ message: "Waiting for you" });
		case "unknown":
			return t({ message: "Unknown state" });
		default:
			return null;
	}
}

export function AgentSessionRow({
	session,
	now,
	isStale,
	maxMemory,
	disabled,
	onOpen,
	onClose,
}: {
	session: AgentSessionView;
	now: number;
	/** Unanswered past the cleanup threshold. */
	isStale: boolean;
	/** The heaviest session's memory, to scale the bar. */
	maxMemory: number;
	disabled: boolean;
	onOpen: () => void;
	onClose: () => void;
}) {
	const { t } = useLingui();
	const statusLabel = useStatusLabel(session);
	const answeredAt = getLastAnsweredAt(session);
	const processCount = session.processCount;
	const memoryShare =
		maxMemory > 0 ? Math.max(4, (session.memory / maxMemory) * 100) : 0;
	const canOpen = session.terminalId !== null;

	return (
		<div
			className={cn(
				ROW_GRID,
				"group border-b px-3 py-1.5 last:border-b-0 transition-colors hover:bg-foreground/[0.04]",
			)}
		>
			<button
				type="button"
				onClick={onOpen}
				disabled={!canOpen}
				className="flex min-w-0 items-center gap-2.5 text-left disabled:cursor-default"
			>
				<span
					className={cn(
						"h-2 w-2 shrink-0 rounded-full",
						STATUS_DOT[session.status],
					)}
				/>
				<span className="flex min-w-0 flex-col">
					<span className="flex min-w-0 items-center gap-2">
						<span className="truncate text-[13px]">{session.title}</span>
						{statusLabel && (
							<span
								className={cn(
									"shrink-0 truncate rounded px-1.5 py-px text-[10px]",
									session.status === "waiting"
										? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
										: "bg-muted text-muted-foreground",
								)}
							>
								{statusLabel}
							</span>
						)}
					</span>
					<span className="truncate text-[11px] text-muted-foreground">
						{session.workspaceLabel}
						{" · "}
						{t({
							message: plural(processCount, {
								one: "# process",
								other: "# processes",
							}),
						})}
					</span>
				</span>
			</button>
			<span
				className={cn(
					"text-right text-xs tabular-nums",
					isStale
						? "text-amber-700 dark:text-amber-300"
						: "text-muted-foreground",
				)}
			>
				{answeredAt === null ? "—" : formatAge(answeredAt, now)}
			</span>
			<span className="text-right text-xs tabular-nums text-muted-foreground">
				{formatCpu(session.cpu)}
			</span>
			<span className="flex flex-col items-end gap-1">
				<span className="text-xs tabular-nums">
					{formatMemory(session.memory)}
				</span>
				<span className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
					<span
						className="block h-full rounded-full bg-foreground/40 transition-[width] duration-300"
						style={{ width: `${memoryShare}%` }}
					/>
				</span>
			</span>
			<span className="flex items-center justify-end gap-0.5 opacity-50 transition-opacity group-hover:opacity-100">
				{canOpen && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-6"
								onClick={onOpen}
								aria-label={t({ message: "Open session" })}
							>
								<LuArrowUpRight className="size-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t({ message: "Open session" })}</TooltipContent>
					</Tooltip>
				)}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="size-6 hover:text-red-600 dark:hover:text-red-400"
							disabled={disabled}
							onClick={onClose}
							aria-label={t({ message: "Close session" })}
						>
							<HiMiniXMark className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t({ message: "Close session" })}</TooltipContent>
				</Tooltip>
			</span>
		</div>
	);
}
