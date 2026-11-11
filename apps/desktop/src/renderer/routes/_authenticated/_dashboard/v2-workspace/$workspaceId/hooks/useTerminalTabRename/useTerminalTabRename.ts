import { useLingui } from "@lingui/react/macro";
import {
	type createWorkspaceStore,
	pickTabTitlePane,
	type Tab,
} from "@superset/panes";
import { toast } from "@superset/ui/sonner";
import { workspaceTrpc } from "@superset/workspace-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { clearTerminalNames } from "renderer/lib/clearTerminalNames";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import type { PaneViewerData, TerminalPaneData } from "../../types";

/**
 * With synced names, renaming a terminal tab renames its session on the
 * host, the name the sidebar shows, instead of keeping a local tab name.
 */
export function useTerminalTabRename({
	workspaceId,
	store,
}: {
	workspaceId: string;
	store: ReturnType<typeof createWorkspaceStore<PaneViewerData>>;
}) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const syncNames = useSidebarPreference("syncConversationNames");
	const { mutateAsync: renameSession } =
		workspaceTrpc.terminal.rename.useMutation();
	const utils = workspaceTrpc.useUtils();

	return useCallback(
		(tab: Tab<PaneViewerData>, title: string | undefined): boolean => {
			if (!syncNames) return false;
			const pane = pickTabTitlePane(tab);
			if (pane?.kind !== "terminal") return false;
			const { terminalId } = pane.data as TerminalPaneData;
			store
				.getState()
				.replaceState((state) => clearTerminalNames(state, terminalId));
			renameSession({ workspaceId, terminalId, title: title ?? "" })
				.then(() =>
					Promise.all([
						utils.terminal.list.invalidate({ workspaceId }),
						queryClient.invalidateQueries({
							queryKey: ["host-terminal-titles"],
						}),
					]),
				)
				.catch(() => toast.error(t`Failed to rename session`));
			return true;
		},
		[syncNames, store, renameSession, workspaceId, utils, queryClient, t],
	);
}
