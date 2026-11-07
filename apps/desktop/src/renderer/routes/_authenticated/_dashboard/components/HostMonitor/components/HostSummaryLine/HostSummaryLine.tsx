import { Plural, useLingui } from "@lingui/react/macro";
import { useFormat } from "@superset/i18n/react";
import { cn } from "@superset/ui/lib/utils";
import { VERDICT_TONE } from "renderer/components/HostMetricsDetails";
import {
	getHostLoad,
	getHostVerdict,
	type HostMetrics,
	toGigabytes,
} from "renderer/hooks/host-service/useHostMetrics";

interface HostSummaryLineProps {
	name: string;
	metrics: HostMetrics;
	className?: string;
}

/** "● Tour · RAM 11/20 GB · 7 agents" */
export function HostSummaryLine({
	name,
	metrics,
	className,
}: HostSummaryLineProps) {
	const { t } = useLingui();
	const { formatNumber } = useFormat();
	const tone = VERDICT_TONE[getHostVerdict(getHostLoad(metrics))];
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
			<span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
			<span className="min-w-0 truncate">{name}</span>
			<span className="text-muted-foreground/60">·</span>
			<span className={cn("shrink-0 tabular-nums", tone.text)}>
				{t({ message: "RAM" })} {used}/{total}
			</span>
			<span className="text-muted-foreground/60">·</span>
			<span className="shrink-0 tabular-nums">
				<Plural value={metrics.agents} one="# agent" other="# agents" />
			</span>
		</span>
	);
}
