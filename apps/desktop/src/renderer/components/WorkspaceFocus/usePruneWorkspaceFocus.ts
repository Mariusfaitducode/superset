import { useEffect } from "react";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useWorkspaceFocusStore } from "renderer/stores/workspace-focus";

/**
 * Takes archived workspaces out of focus. Only archived ones: a workspace
 * missing from the list may sit on a host that is offline right now.
 */
export function usePruneWorkspaceFocus() {
	const { workspaces } = useHostWorkspaces();
	useEffect(() => {
		const archived = workspaces
			.filter((workspace) => workspace.archivedAt != null)
			.map((workspace) => workspace.id);
		if (archived.length > 0) {
			useWorkspaceFocusStore.getState().forget(archived);
		}
	}, [workspaces]);
}
