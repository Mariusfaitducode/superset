import { electronTrpc } from "renderer/lib/electron-trpc";
import { AppMenuButton } from "renderer/routes/_authenticated/_dashboard/components/AppMenuButton";
import { NavigationControls } from "renderer/routes/_authenticated/_dashboard/components/NavigationControls";
import {
	WINDOW_CONTROLS_ROW_HEIGHT,
	WINDOW_CONTROLS_ROW_TOP,
} from "renderer/routes/_authenticated/_dashboard/components/WindowChrome";
import {
	COLLAPSED_WORKSPACE_SIDEBAR_WIDTH,
	useWorkspaceSidebarStore,
} from "renderer/stores/workspace-sidebar-state";
import { SettingsNavPanel } from "../SettingsNavPanel";

/** v1 only: v2 shows the Settings navigation inside the app sidebar. */
export function SettingsSidebar() {
	const sidebarWidth = useWorkspaceSidebarStore(
		(state) => state.lastExpandedWidth,
	);
	const { data: platform } = electronTrpc.window.getPlatform.useQuery();
	const isMac = platform === undefined || platform === "darwin";

	return (
		<div
			className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar pb-2 dark:bg-muted/35"
			style={{ width: sidebarWidth }}
		>
			<div className="mb-1 flex h-12 shrink-0 items-center">
				{isMac ? (
					<div className="drag h-full shrink-0" style={{ width: 96 }} />
				) : (
					<div
						className="flex shrink-0 items-center justify-center self-start"
						style={{
							width: COLLAPSED_WORKSPACE_SIDEBAR_WIDTH,
							marginTop: WINDOW_CONTROLS_ROW_TOP,
							height: WINDOW_CONTROLS_ROW_HEIGHT,
						}}
					>
						<AppMenuButton />
					</div>
				)}
				<div
					className="flex shrink-0 items-center self-start"
					style={{
						marginTop: WINDOW_CONTROLS_ROW_TOP,
						height: WINDOW_CONTROLS_ROW_HEIGHT,
					}}
				>
					<NavigationControls />
				</div>
				<div className="drag h-full min-w-0 flex-1" />
			</div>
			<SettingsNavPanel />
		</div>
	);
}
