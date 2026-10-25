import { type HotkeyId, useHotkey } from "renderer/hotkeys";

interface SidebarNavHotkeyProps {
	hotkeyId: HotkeyId;
	onTrigger: () => void;
	enabled: boolean;
}

/** One menu entry's shortcut; a component so the entries can be mapped. */
export function SidebarNavHotkey({
	hotkeyId,
	onTrigger,
	enabled,
}: SidebarNavHotkeyProps) {
	useHotkey(hotkeyId, onTrigger, { enabled });
	return null;
}
