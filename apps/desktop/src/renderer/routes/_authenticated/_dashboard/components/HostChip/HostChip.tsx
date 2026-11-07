import { useLingui } from "@lingui/react/macro";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import type { HostAgentCounts } from "renderer/routes/_authenticated/_dashboard/utils/summarizeHosts";
import { AgentCount } from "./components/AgentCount";

export function HostChip({
	isSelected,
	onClick,
	icon,
	label,
	isOnline,
	counts,
	tooltip,
	size = "sm",
}: {
	isSelected: boolean;
	onClick: () => void;
	icon: ReactNode;
	label: string;
	/** Undefined for the "All" chip, which has no presence. */
	isOnline?: boolean;
	counts: HostAgentCounts;
	/** The first tooltip line; the agent counts follow it. */
	tooltip: ReactNode;
	size?: "sm" | "md";
}) {
	const { t } = useLingui();
	const { working, needsYou, idle } = counts;
	return (
		<Tooltip delayDuration={400}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-pressed={isSelected}
					onClick={onClick}
					className={cn(
						"flex max-w-full items-center gap-1 rounded-full border transition-colors",
						size === "sm"
							? "h-5 px-1.5 text-[11px]"
							: "h-7 gap-1.5 px-2.5 text-xs",
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
				<div>{tooltip}</div>
				<div className="text-muted-foreground">
					{t({
						message: `${working} working · ${needsYou} waiting for you · ${idle} idle`,
					})}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
