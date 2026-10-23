import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import type { CSSProperties } from "react";

/**
 * The click and hover target over one desk; the canvas draws the agent.
 */
export function OfficeSeatButton({
	title,
	stateLabel,
	topTodo,
	selected,
	style,
	onSelect,
}: {
	title: string;
	stateLabel: string;
	topTodo: string | null;
	selected: boolean;
	style: CSSProperties;
	onSelect: () => void;
}) {
	return (
		<Tooltip delayDuration={150}>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onSelect}
					aria-label={`${title} · ${stateLabel}`}
					aria-pressed={selected}
					style={style}
					className={cn(
						"absolute rounded-sm outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring",
						selected && "ring-2 ring-yellow-300",
					)}
				/>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-64">
				<p className="truncate font-medium">{title}</p>
				<p className="opacity-70">{stateLabel}</p>
				{topTodo && <p className="mt-1 line-clamp-2">☐ {topTodo}</p>}
			</TooltipContent>
		</Tooltip>
	);
}
