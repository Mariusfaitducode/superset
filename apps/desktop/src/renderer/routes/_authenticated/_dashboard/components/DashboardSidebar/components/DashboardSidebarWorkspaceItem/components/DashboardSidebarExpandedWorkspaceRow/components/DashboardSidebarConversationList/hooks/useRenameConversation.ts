import type { WorkspaceState } from "@superset/panes";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { clearTerminalNames } from "renderer/lib/clearTerminalNames";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import { hostTerminalTitlesQueryKey } from "./hostTerminalTitles";

/**
 * Names the conversation's terminal session on its host, as the terminal's
 * own session menu does, so every client listing the session sees it. An
 * empty name gives the title back to the agent.
 */
export function useRenameConversation({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}) {
	const queryClient = useQueryClient();
	const collections = useCollections();
	const syncNames = useSidebarPreference("syncConversationNames");
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: cache.resolveHostUrl(hostId);

	return useCallback(
		async (terminalId: string, title: string) => {
			if (!hostUrl) return;
			await getHostServiceClientByUrl(hostUrl).terminal.rename.mutate({
				workspaceId,
				terminalId,
				title,
			});
			const row = collections.v2WorkspaceLocalState.get(workspaceId);
			const layout = row?.paneLayout as WorkspaceState<unknown> | undefined;
			if (syncNames && layout) {
				const cleared = clearTerminalNames(layout, terminalId);
				if (cleared !== layout) {
					collections.v2WorkspaceLocalState.update(workspaceId, (draft) => {
						draft.paneLayout = cleared as typeof draft.paneLayout;
					});
				}
			}
			await queryClient.invalidateQueries({
				queryKey: hostTerminalTitlesQueryKey(hostUrl),
			});
		},
		[hostUrl, queryClient, workspaceId, collections, syncNames],
	);
}
