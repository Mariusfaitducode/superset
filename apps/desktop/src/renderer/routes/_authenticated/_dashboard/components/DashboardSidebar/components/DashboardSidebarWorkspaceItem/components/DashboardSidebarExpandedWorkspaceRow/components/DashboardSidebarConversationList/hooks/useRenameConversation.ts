import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { conversationTitlesQueryKey } from "./useWorkspaceConversations";

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
			await queryClient.invalidateQueries({
				queryKey: conversationTitlesQueryKey(workspaceId),
			});
		},
		[hostUrl, queryClient, workspaceId],
	);
}
