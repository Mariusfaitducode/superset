import { Trans, useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { formatMemory } from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/utils/formatters";
import type { AgentResourcesSnapshot } from "../../types";
import {
	getMachineVerdict,
	type MachineVerdict,
} from "../../utils/getMachineVerdict";

type Machine = AgentResourcesSnapshot["machine"];

const VERDICT_TONE: Record<MachineVerdict, { dot: string; text: string }> = {
	room: { dot: "bg-emerald-500", text: "text-foreground" },
	tight: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
	critical: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
	unknown: { dot: "bg-muted-foreground/40", text: "text-foreground" },
};

function ratioTone(ratio: number): string {
	if (ratio >= 0.9) return "bg-red-500/80";
	if (ratio >= 0.75) return "bg-amber-500/80";
	return "bg-foreground/50";
}

function Gauge({
	label,
	used,
	total,
}: {
	label: string;
	used: number;
	total: number | null;
}) {
	const ratio = total && total > 0 ? Math.min(1, used / total) : null;
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<span className="truncate text-[10px] text-muted-foreground">
				{label}
			</span>
			<span className="truncate text-[13px] font-medium tabular-nums">
				{formatMemory(used)}
				{total !== null && (
					<span className="font-normal text-muted-foreground">
						{" / "}
						{formatMemory(total)}
					</span>
				)}
			</span>
			{ratio !== null && (
				<div className="h-1 w-full overflow-hidden rounded-full bg-muted">
					<div
						className={cn(
							"h-full rounded-full transition-[width] duration-300",
							ratioTone(ratio),
						)}
						style={{ width: `${Math.max(ratio * 100, 2)}%` }}
					/>
				</div>
			)}
		</div>
	);
}

/**
 * Answers "can I start another agent?" first, then shows what backs the
 * answer. Pressure leads: macOS keeps RAM near full on purpose.
 */
export function MachineHeader({
	machine,
	agentsMemory,
	collectMs,
}: {
	machine: Machine;
	agentsMemory: number;
	collectMs: number;
}) {
	const { t } = useLingui();
	const verdict = getMachineVerdict(machine);
	const tone = VERDICT_TONE[verdict];
	const measuredMs = Math.round(collectMs);
	const load = machine.loadAverage1m.toFixed(1);
	const cores = machine.cpuCoreCount;

	const headline =
		verdict === "critical"
			? t({ message: "Memory is critical: close agents now" })
			: verdict === "tight"
				? t({
						message:
							"Memory is tight: close idle agents before starting another",
					})
				: verdict === "room"
					? t({ message: "Room for another agent" })
					: t({ message: "Memory pressure unknown" });

	return (
		<div className="overflow-hidden rounded-lg border">
			<div className="flex items-center gap-2 border-b px-3 py-2">
				<span
					className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot, {
						"animate-pulse": verdict === "critical",
					})}
				/>
				<span
					className={cn("min-w-0 truncate text-[13px] font-medium", tone.text)}
				>
					{headline}
				</span>
				<span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
					<Trans>Live · measured in {measuredMs} ms</Trans>
				</span>
			</div>
			<div className="grid grid-cols-2 gap-x-5 gap-y-3 px-3 py-2.5 sm:grid-cols-3 lg:grid-cols-5">
				<Gauge
					label={t({ message: "Agents" })}
					used={agentsMemory}
					total={machine.totalMemory}
				/>
				<Gauge
					label={t({ message: "RAM in use" })}
					used={machine.usedMemory}
					total={machine.totalMemory}
				/>
				<Gauge
					label={t({ message: "Swap" })}
					used={machine.swapUsed}
					total={machine.swapTotal}
				/>
				<div className="flex min-w-0 flex-col gap-1">
					<span className="truncate text-[10px] text-muted-foreground">
						<Trans>Load (1 min)</Trans>
					</span>
					<span className="text-[13px] font-medium tabular-nums">
						{load}
						<span className="font-normal text-muted-foreground">
							{" "}
							<Trans>on {cores} cores</Trans>
						</span>
					</span>
				</div>
				{machine.docker.memoryUsed === null ? (
					<div className="flex min-w-0 flex-col gap-1">
						<span className="truncate text-[10px] text-muted-foreground">
							<Trans>Docker VM</Trans>
						</span>
						<span className="text-[13px] text-muted-foreground">
							<Trans>Not running</Trans>
						</span>
					</div>
				) : (
					<Gauge
						label={t({ message: "Docker VM" })}
						used={machine.docker.memoryUsed}
						total={machine.docker.memoryLimit}
					/>
				)}
			</div>
		</div>
	);
}
