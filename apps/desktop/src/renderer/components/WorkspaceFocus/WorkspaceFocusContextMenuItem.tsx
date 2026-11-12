import { Trans } from "@lingui/react/macro";
import {
	ContextMenuItem,
	ContextMenuShortcut,
} from "@superset/ui/context-menu";
import { LuTarget } from "react-icons/lu";
import { useHotkeyDisplay } from "renderer/hotkeys";
import {
	useIsWorkspaceFocused,
	useWorkspaceFocusStore,
} from "renderer/stores/workspace-focus";

/** "Add to focus" / "Remove from focus" in a workspace's right-click menu. */
export function WorkspaceFocusContextMenuItem({
	workspaceId,
	showHotkey = false,
	iconClassName = "size-4 mr-2",
}: {
	workspaceId: string;
	/** Only for the workspace on screen, which the shortcut acts on. */
	showHotkey?: boolean;
	iconClassName?: string;
}) {
	const focused = useIsWorkspaceFocused(workspaceId);
	const toggle = useWorkspaceFocusStore((state) => state.toggle);
	const hotkey = useHotkeyDisplay("TOGGLE_WORKSPACE_FOCUS").text;
	return (
		<ContextMenuItem onSelect={() => toggle(workspaceId)}>
			<LuTarget className={iconClassName} />
			{focused ? <Trans>Remove from focus</Trans> : <Trans>Add to focus</Trans>}
			{showHotkey && hotkey !== "Unassigned" && (
				<ContextMenuShortcut>{hotkey}</ContextMenuShortcut>
			)}
		</ContextMenuItem>
	);
}
