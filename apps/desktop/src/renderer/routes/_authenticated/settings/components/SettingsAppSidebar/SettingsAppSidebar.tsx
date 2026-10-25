import { DashboardSidebar } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar";
import { DashboardSidebarPortsProvider } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarPortsProvider";
import { PortForwardsProvider } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/PortForwardsProvider";
import { ResizablePanel } from "renderer/screens/main/components/ResizablePanel";
import {
	COLLAPSED_WORKSPACE_SIDEBAR_WIDTH,
	DEFAULT_WORKSPACE_SIDEBAR_WIDTH,
	MAX_WORKSPACE_SIDEBAR_WIDTH,
	useWorkspaceSidebarStore,
} from "renderer/stores/workspace-sidebar-state";

/** The workspace sidebar, kept on the left while Settings is open. */
export function SettingsAppSidebar() {
	const { width, setWidth, isResizing, setIsResizing, isCollapsed } =
		useWorkspaceSidebarStore();
	return (
		<DashboardSidebarPortsProvider enabled={false}>
			<PortForwardsProvider>
				<ResizablePanel
					width={width}
					onWidthChange={setWidth}
					isResizing={isResizing}
					onResizingChange={setIsResizing}
					minWidth={COLLAPSED_WORKSPACE_SIDEBAR_WIDTH}
					maxWidth={MAX_WORKSPACE_SIDEBAR_WIDTH}
					handleSide="right"
					clampWidth={false}
					onDoubleClickHandle={() => setWidth(DEFAULT_WORKSPACE_SIDEBAR_WIDTH)}
				>
					<DashboardSidebar isCollapsed={isCollapsed()} />
				</ResizablePanel>
			</PortForwardsProvider>
		</DashboardSidebarPortsProvider>
	);
}
