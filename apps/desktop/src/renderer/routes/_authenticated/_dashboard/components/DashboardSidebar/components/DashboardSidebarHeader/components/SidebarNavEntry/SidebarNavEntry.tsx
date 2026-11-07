import { useLingui } from "@lingui/react/macro";
import { type HotkeyId, useHotkey } from "renderer/hotkeys";
import {
	NAV_ITEM_HOTKEY,
	NAV_ITEM_LABEL,
} from "renderer/stores/sidebar-preferences";
import type { SidebarNavEntry as SidebarNavEntryDef } from "../../navEntries";
import { SidebarNavButton } from "../SidebarNavButton";
import { SidebarNavIconButton } from "../SidebarNavIconButton";
import { SidebarNavRailButton } from "../SidebarNavRailButton";

export type SidebarNavVariant = "row" | "icon" | "rail";

const ICON_CLASS: Record<SidebarNavVariant, string> = {
	row: "size-4 shrink-0 text-muted-foreground",
	icon: "size-4 shrink-0",
	rail: "size-3.5",
};

/**
 * One page of the sidebar menu. Stays mounted while hidden so its shortcut
 * keeps working.
 */
export function SidebarNavEntry({
	entry,
	variant,
	hidden,
}: {
	entry: SidebarNavEntryDef;
	variant: SidebarNavVariant;
	hidden: boolean;
}) {
	const { i18n } = useLingui();
	const target = entry.useTarget();
	const hotkeyId = NAV_ITEM_HOTKEY[entry.id];
	useHotkey((hotkeyId ?? "") as HotkeyId, target.onClick, {
		enabled: target.available && hotkeyId !== undefined,
	});
	if (!target.available || hidden) return null;

	const label = i18n._(NAV_ITEM_LABEL[entry.id]);
	const Icon = entry.icon;
	const icon = (
		<Icon
			className={ICON_CLASS[variant]}
			strokeWidth={entry.thinStroke ? 1.5 : undefined}
		/>
	);
	const badge = target.badge && target.badge.count > 0 ? target.badge : null;

	if (variant === "icon") {
		return (
			<SidebarNavIconButton
				label={label}
				icon={icon}
				hotkeyId={hotkeyId}
				isActive={target.isActive}
				onClick={target.onClick}
				badge={badge}
			/>
		);
	}
	if (variant === "rail") {
		return (
			<SidebarNavRailButton
				label={label}
				tooltip={badge ? `${label} (${badge.title})` : undefined}
				icon={icon}
				hotkeyId={hotkeyId}
				isActive={target.isActive}
				onClick={target.onClick}
				showAlertDot={badge !== null}
			/>
		);
	}
	return (
		<SidebarNavButton
			label={label}
			icon={icon}
			hotkeyId={hotkeyId}
			isActive={target.isActive}
			onClick={target.onClick}
			badge={
				badge ? (
					<button
						type="button"
						onClick={badge.onClick ?? target.onClick}
						title={badge.title}
						className={
							badge.tone === "alert"
								? "absolute right-2 top-1/2 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-red-500/15 px-1 text-[10px] font-medium tabular-nums text-red-600 transition-colors hover:bg-red-500/25 dark:text-red-400"
								: "absolute right-2 top-1/2 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--sb-state-needsYou)_20%,transparent)] px-1 text-[10px] font-medium tabular-nums text-foreground transition-colors"
						}
					>
						{badge.count > 9 ? "9+" : badge.count}
					</button>
				) : undefined
			}
		/>
	);
}
