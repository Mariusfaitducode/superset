import { cn } from "@superset/ui/lib/utils";
import { shareBarClass } from "renderer/components/HostMetricsDetails/verdictTone";
import type { HostLoad } from "renderer/hooks/host-service/useHostMetrics";

/** Two thin vertical gauges, memory then CPU, for a narrow trigger. */
export function HostLoadBars({ load }: { load: HostLoad | null }) {
	return (
		<span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
			{[load?.memory ?? null, load?.cpu ?? null].map((share, index) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed two-item list
					key={index}
					className="relative h-full w-[3px] overflow-hidden rounded-full bg-foreground/15"
				>
					<span
						className={cn(
							"absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500",
							share !== null && share >= 0.75
								? shareBarClass(share)
								: "bg-current",
						)}
						style={{ height: `${Math.round((share ?? 0) * 100)}%` }}
					/>
				</span>
			))}
		</span>
	);
}
