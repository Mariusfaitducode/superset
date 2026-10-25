import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { type HotkeyId, useHotkeyDisplay } from "renderer/hotkeys";

interface SidebarNavRailButtonProps {
	label: string;
	/** Tooltip text when it says more than the label. */
	tooltip?: string;
	icon: ReactNode;
	hotkeyId: HotkeyId;
	isActive: boolean;
	onClick: () => void;
	showAlertDot?: boolean;
}

export function SidebarNavRailButton({
	label,
	tooltip,
	icon,
	hotkeyId,
	isActive,
	onClick,
	showAlertDot = false,
}: SidebarNavRailButtonProps) {
	const shortcut = useHotkeyDisplay(hotkeyId).text;
	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					aria-label={tooltip ?? label}
					aria-current={isActive ? "page" : undefined}
					className={cn(
						"relative flex size-7 items-center justify-center rounded-md transition-colors",
						isActive
							? "bg-fill-selected text-muted-foreground"
							: "text-muted-foreground hover:bg-fill-hover",
					)}
				>
					{icon}
					{showAlertDot && (
						<span
							aria-hidden="true"
							className="absolute right-1 top-1 size-1.5 rounded-full bg-red-500"
						/>
					)}
				</button>
			</TooltipTrigger>
			<TooltipContent side="right">
				{shortcut !== "Unassigned"
					? `${tooltip ?? label} (${shortcut})`
					: (tooltip ?? label)}
			</TooltipContent>
		</Tooltip>
	);
}
