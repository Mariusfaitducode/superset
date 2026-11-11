import { useIsSidebarRail } from "renderer/routes/_authenticated/_dashboard/hooks/useIsSidebarRail";
import { useShowsAppTopBar } from "renderer/routes/_authenticated/_dashboard/hooks/useShowsAppTopBar";

/** True while the sidebar is a rail: every header in the window's top row joins one band. */
export function useCollapsedSidebarBand(): boolean {
	const showsAppTopBar = useShowsAppTopBar();
	const isSidebarRail = useIsSidebarRail();
	return !showsAppTopBar && isSidebarRail;
}
