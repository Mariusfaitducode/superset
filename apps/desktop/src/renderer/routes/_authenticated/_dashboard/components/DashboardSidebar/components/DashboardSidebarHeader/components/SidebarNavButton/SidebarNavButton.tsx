import { cn } from "@superset/ui/utils";
import type { ReactNode } from "react";
import { SidebarKbdHint } from "renderer/components/SidebarKbdHint";
import { type HotkeyId, useHotkeyDisplay } from "renderer/hotkeys";

interface SidebarNavButtonProps {
	label: string;
	icon: ReactNode;
	hotkeyId: HotkeyId;
	isActive: boolean;
	onClick: () => void;
	/** Drawn over the row's right end instead of the shortcut, e.g. a count. */
	badge?: ReactNode;
}

export function SidebarNavButton({
	label,
	icon,
	hotkeyId,
	isActive,
	onClick,
	badge,
}: SidebarNavButtonProps) {
	const shortcut = useHotkeyDisplay(hotkeyId).text;
	return (
		<div className="relative">
			<button
				type="button"
				onClick={onClick}
				aria-current={isActive ? "page" : undefined}
				className={cn(
					"group flex h-[var(--sb-row-h)] w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors",
					isActive
						? "bg-fill-selected text-foreground"
						: "text-muted-foreground hover:bg-fill-hover hover:text-foreground",
				)}
			>
				{icon}
				<span className="flex-1 truncate text-left">{label}</span>
				{!badge && shortcut !== "Unassigned" && (
					<SidebarKbdHint label={shortcut} />
				)}
			</button>
			{badge}
		</div>
	);
}
