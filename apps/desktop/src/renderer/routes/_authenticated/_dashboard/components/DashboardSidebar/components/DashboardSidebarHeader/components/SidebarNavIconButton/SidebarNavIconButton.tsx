import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { type HotkeyId, HotkeyLabel } from "renderer/hotkeys";
import type { SidebarNavBadge } from "../../navEntries";

const BADGE_TONE_CLASS: Record<SidebarNavBadge["tone"], string> = {
	alert: "bg-[var(--sb-state-failed)] text-white",
	attention: "bg-[var(--sb-state-needsYou)] text-black",
};

/** One page in the expanded sidebar's icon bar. */
export function SidebarNavIconButton({
	label,
	icon,
	hotkeyId,
	isActive,
	onClick,
	badge,
}: {
	label: string;
	icon: ReactNode;
	hotkeyId?: HotkeyId;
	isActive: boolean;
	onClick: () => void;
	badge?: SidebarNavBadge | null;
}) {
	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					aria-label={badge ? `${label} (${badge.title})` : label}
					aria-current={isActive ? "page" : undefined}
					className={cn(
						"relative flex size-7 items-center justify-center rounded-md transition-colors",
						isActive
							? "bg-fill-selected text-foreground"
							: "text-muted-foreground hover:bg-fill-hover hover:text-foreground",
					)}
				>
					{icon}
					{badge && badge.count > 0 && (
						<span
							aria-hidden="true"
							className={cn(
								"absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold tabular-nums leading-none",
								BADGE_TONE_CLASS[badge.tone],
							)}
						>
							{badge.count > 9 ? "9+" : badge.count}
						</span>
					)}
				</button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				<HotkeyLabel label={label} id={hotkeyId} />
				{badge && (
					<p className="text-xs text-muted-foreground">{badge.title}</p>
				)}
			</TooltipContent>
		</Tooltip>
	);
}
