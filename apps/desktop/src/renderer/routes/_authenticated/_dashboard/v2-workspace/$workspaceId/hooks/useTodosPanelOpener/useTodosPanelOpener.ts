import { useEffect } from "react";
import { useTodosPanelStore } from "renderer/stores/todos-panel";

/**
 * Shows the to-dos view a sidebar to-do button asked for before navigating
 * here. Waits for the pane layouts so a to-dos pane lands in the restored
 * tabs rather than a placeholder that gets replaced.
 */
export function useTodosPanelOpener({
	workspaceId,
	isLayoutReady,
	openTodos,
}: {
	workspaceId: string;
	isLayoutReady: boolean;
	openTodos: () => void;
}): void {
	const openRequest = useTodosPanelStore((state) => state.openRequest);

	useEffect(() => {
		if (!isLayoutReady || openRequest !== workspaceId) return;
		if (!useTodosPanelStore.getState().consume(workspaceId)) return;
		openTodos();
	}, [openRequest, workspaceId, isLayoutReady, openTodos]);
}
