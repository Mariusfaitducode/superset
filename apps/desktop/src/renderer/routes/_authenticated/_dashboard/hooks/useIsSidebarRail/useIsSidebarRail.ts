import { useWorkspaceSidebarStore } from "renderer/stores/workspace-sidebar-state";
import { useIsSettingsOpen } from "../useIsSettingsOpen";

/** Settings needs its navigation, so the sidebar shows expanded there even when collapsed to its rail. */
export function useIsSidebarRail(): boolean {
	const isCollapsed = useWorkspaceSidebarStore((s) => s.isCollapsed());
	const isSettingsOpen = useIsSettingsOpen();
	return isCollapsed && !isSettingsOpen;
}
