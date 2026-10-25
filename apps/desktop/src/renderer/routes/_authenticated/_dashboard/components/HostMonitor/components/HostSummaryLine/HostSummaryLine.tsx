import { Plural, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import { cn } from "@superset/ui/lib/utils";
import {
	getHostLoad,
	type HostMetrics,
	isHotShare,
	toGigabytes,
} from "renderer/hooks/host-service/useHostMetrics";

interface HostSummaryLineProps {
	name: string;
	metrics: HostMetrics;
	className?: string;
}

/** "Tower · CPU 34% · RAM 11/20 GB · 7 agents" */
export function HostSummaryLine({
	name,
	metrics,
	className,
}: HostSummaryLineProps) {
	const { t } = useLingui();
	const { formatNumber, formatPercent } = useFormat();
	const load = getHostLoad(metrics);
	const used = formatNumber(toGigabytes(metrics.memory.usedBytes), {
		maximumFractionDigits: 0,
	});
	const total = formatNumber(toGigabytes(metrics.memory.totalBytes), {
		style: "unit",
		unit: "gigabyte",
		maximumFractionDigits: 0,
	});
	return (
		<span className={cn("flex min-w-0 items-center gap-1.5", className)}>
			<span className="min-w-0 truncate">{name}</span>
			<span className="text-muted-foreground/60">·</span>
			<span
				className={cn(
					"shrink-0 tabular-nums",
					isHotShare(load.cpu) && "text-red-500",
				)}
			>
				{t({ message: "CPU" })}{" "}
				{load.cpu === null
					? "—"
					: formatPercent(load.cpu, { maximumFractionDigits: 0 })}
			</span>
			<span className="text-muted-foreground/60">·</span>
			<span
				className={cn(
					"shrink-0 tabular-nums",
					isHotShare(load.memory) && "text-red-500",
				)}
			>
				{t({ message: "RAM" })} {used}/{total}
			</span>
			<span className="text-muted-foreground/60">·</span>
			<span className="shrink-0 tabular-nums">
				<Plural value={metrics.agents.active} one="# agent" other="# agents" />
			</span>
		</span>
	);
}
