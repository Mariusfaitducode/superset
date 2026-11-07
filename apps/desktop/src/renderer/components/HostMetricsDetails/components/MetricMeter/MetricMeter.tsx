import { cn } from "@superset/ui/lib/utils";
import { shareBarClass } from "../../verdictTone";

interface MetricMeterProps {
	label: string;
	value: string;
	/** 0–1; null draws an empty track. */
	share: number | null;
}

export function MetricMeter({ label, value, share }: MetricMeterProps) {
	return (
		<div className="space-y-1">
			<div className="flex items-baseline justify-between gap-3 text-xs">
				<span className="text-muted-foreground">{label}</span>
				<span className="tabular-nums text-foreground">{value}</span>
			</div>
			<div className="h-1 overflow-hidden rounded-full bg-foreground/10">
				<div
					className={cn(
						"h-full rounded-full transition-[width] duration-500",
						shareBarClass(share),
					)}
					style={{ width: `${Math.round((share ?? 0) * 100)}%` }}
				/>
			</div>
		</div>
	);
}
