import { Plural, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import { cn } from "@superset/ui/lib/utils";
import {
	getHostLoad,
	getHostVerdict,
	type HostMetrics,
	type HostVerdict,
	toGigabytes,
} from "renderer/hooks/host-service/useHostMetrics";
import { MetricMeter } from "./components/MetricMeter";
import { TopWorkspacesList } from "./components/TopWorkspacesList";
import { VERDICT_TONE } from "./verdictTone";

interface HostMetricsDetailsProps {
	metrics: HostMetrics;
	/** Called before opening one of the listed workspaces. */
	onNavigate?: () => void;
}

/** "Can this host take another agent?", then what backs the answer. */
export function HostMetricsDetails({
	metrics,
	onNavigate,
}: HostMetricsDetailsProps) {
	const { t } = useLingui();
	const { formatNumber, formatPercent } = useFormat();
	const load = getHostLoad(metrics);
	const verdict = getHostVerdict(load);
	const tone = VERDICT_TONE[verdict];

	const headline: Record<HostVerdict, string> = {
		room: t({ message: "Room for another agent" }),
		tight: t({ message: "Tight: close idle agents before starting another" }),
		critical: t({ message: "Full: close agents before starting another" }),
	};
	const usedOfTotal = (used: number, total: number) =>
		`${formatNumber(toGigabytes(used), { maximumFractionDigits: 1 })} / ${formatNumber(
			toGigabytes(total),
			{ style: "unit", unit: "gigabyte", maximumFractionDigits: 0 },
		)}`;

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2 text-xs">
				<span className={cn("size-2 shrink-0 rounded-full", tone.dot)} />
				<span className={cn("min-w-0 flex-1 font-medium", tone.text)}>
					{headline[verdict]}
				</span>
				<span className="shrink-0 tabular-nums text-muted-foreground">
					<Plural value={metrics.agents} one="# agent" other="# agents" />
				</span>
			</div>
			<div className="space-y-2.5">
				<MetricMeter
					label={t({ message: "Memory" })}
					value={usedOfTotal(
						metrics.memory.usedBytes,
						metrics.memory.totalBytes,
					)}
					share={load.memory}
				/>
				{metrics.swap && (
					<MetricMeter
						label={t({ message: "Swap" })}
						value={usedOfTotal(metrics.swap.usedBytes, metrics.swap.totalBytes)}
						share={load.swap}
					/>
				)}
				<MetricMeter
					label={t({ message: "CPU" })}
					value={load.cpu === null ? "—" : formatPercent(load.cpu)}
					share={load.cpu}
				/>
			</div>
			<TopWorkspacesList
				workspaces={metrics.topWorkspaces}
				onNavigate={onNavigate}
			/>
		</div>
	);
}
