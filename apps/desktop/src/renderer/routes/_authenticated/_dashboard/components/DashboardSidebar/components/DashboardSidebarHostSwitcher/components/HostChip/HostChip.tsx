import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import type { HostAgentCounts } from "../../utils/summarizeHosts";
import { AgentCount } from "./components/AgentCount";

export function HostChip({
	isSelected,
	onClick,
	icon,
	label,
	isOnline,
	counts,
	tooltip,
}: {
	isSelected: boolean;
	onClick: () => void;
	icon: ReactNode;
	label: string;
	/** Undefined for the "All" chip, which has no presence. */
	isOnline?: boolean;
	counts: HostAgentCounts;
	tooltip: ReactNode;
}) {
	return (
		<Tooltip delayDuration={400}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-pressed={isSelected}
					onClick={onClick}
					className={cn(
						"flex h-5 max-w-full items-center gap-1 rounded-full border px-1.5 text-[11px] transition-colors",
						isSelected
							? "border-foreground/40 bg-accent text-foreground"
							: "border-border text-muted-foreground hover:text-foreground",
						isOnline === false && "opacity-60",
					)}
				>
					{isOnline !== undefined && (
						<span
							className={cn(
								"size-1.5 shrink-0 rounded-full",
								isOnline ? "bg-emerald-500" : "bg-muted-foreground/50",
							)}
						/>
					)}
					<span className="shrink-0">{icon}</span>
					<span className="truncate">{label}</span>
					<AgentCount state="working" count={counts.working} />
					<AgentCount state="needsYou" count={counts.needsYou} />
					<AgentCount state="idle" count={counts.idle} />
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="text-xs">
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}
