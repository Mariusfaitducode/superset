import { useMemo } from "react";
import { useHostConversationTodos } from "renderer/hooks/host-service/useHostConversationTodos";
import { useTerminalAgentBindings } from "renderer/hooks/host-service/useTerminalAgentBindings";
import { countOpenTodos } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/hooks/useWorkspaceOpenTodos";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";

/** Open to-dos of the workspace's live conversations, for a tab badge. */
export function useWorkspaceOpenTodoCount({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}): number {
	const showTodos = useSidebarPreference("showTodos");
	const includeAgentTodos = useSidebarPreference("showAgentTodos");
	const bindings = useTerminalAgentBindings(workspaceId, {
		enabled: showTodos,
	});
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: cache.resolveHostUrl(hostId);
	const { data } = useHostConversationTodos(
		hostUrl,
		showTodos && bindings.size > 0,
	);
	return useMemo(() => {
		if (!showTodos || !data || bindings.size === 0) return 0;
		return countOpenTodos({
			todos: data,
			workspaceId,
			liveTerminalIds: bindings,
			includeAgentTodos,
		}).open;
	}, [showTodos, data, bindings, workspaceId, includeAgentTodos]);
}
