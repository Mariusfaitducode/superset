import { cn } from "@superset/ui/utils";
import type { ActivePaneStatus } from "shared/tabs-types";

// Re-export for consumers
export type { ActivePaneStatus } from "shared/tabs-types";

/** Same colors as every agent state dot (`renderer/lib/agent-state`). */
const STATUS_CONFIG = {
	permission: {
		pingColor: "bg-[var(--sb-state-needsYou)]",
		dotColor: "bg-[var(--sb-state-needsYou)]",
		pulse: true,
		tooltip: "Needs you",
	},
	failed: {
		pingColor: "bg-[var(--sb-state-failed)]",
		dotColor: "bg-[var(--sb-state-failed)]",
		pulse: true,
		tooltip: "Agent failed",
	},
	working: {
		pingColor: "",
		dotColor: "bg-[var(--sb-state-working)]",
		pulse: false,
		tooltip: "Agent working",
	},
	review: {
		pingColor: "",
		dotColor: "bg-[var(--sb-state-unseen)]",
		pulse: false,
		tooltip: "Done, not seen yet",
	},
} as const satisfies Record<
	ActivePaneStatus,
	{ pingColor: string; dotColor: string; pulse: boolean; tooltip: string }
>;

interface StatusIndicatorProps {
	status: ActivePaneStatus;
	className?: string;
}

/**
 * Visual indicator for pane/workspace status.
 * - Amber pulsing: needs the user (permission)
 * - Red pulsing: agent failed
 * - Yellow static: agent working
 * - Green static: done, not seen yet
 */
export function StatusIndicator({ status, className }: StatusIndicatorProps) {
	const config = STATUS_CONFIG[status];

	return (
		<span className={cn("relative flex size-1.5 shrink-0", className)}>
			{config.pulse && (
				<span
					className={cn(
						"absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
						config.pingColor,
					)}
				/>
			)}
			<span
				className={cn(
					"relative inline-flex size-full rounded-full",
					config.dotColor,
				)}
			/>
		</span>
	);
}

/** Get tooltip text for a status - for consumers that wrap with Tooltip */
export function getStatusTooltip(status: ActivePaneStatus): string {
	return STATUS_CONFIG[status].tooltip;
}
