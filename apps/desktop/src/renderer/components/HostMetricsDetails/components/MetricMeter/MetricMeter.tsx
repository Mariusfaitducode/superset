import { cn } from "@superset/ui/lib/utils";
import { isHotShare } from "renderer/hooks/host-service/useHostMetrics";

interface MetricMeterProps {
	label: string;
	value: string;
	/** 0–1; null draws an empty track. */
	share: number | null;
}

export function MetricMeter({ label, value, share }: MetricMeterProps) {
	const hot = isHotShare(share);
	return (
		<div className="space-y-1">
			<div className="flex items-baseline justify-between gap-3 text-xs">
				<span className="text-muted-foreground">{label}</span>
				<span
					className={cn("tabular-nums text-foreground", hot && "text-red-500")}
				>
					{value}
				</span>
			</div>
			<div className="h-1 overflow-hidden rounded-full bg-foreground/10">
				<div
					className={cn(
						"h-full rounded-full transition-[width] duration-500",
						hot ? "bg-red-500/80" : "bg-foreground/45",
					)}
					style={{ width: `${Math.round((share ?? 0) * 100)}%` }}
				/>
			</div>
		</div>
	);
}
