import { useMemo } from "react";
import { useHostConversationTodos } from "renderer/hooks/host-service/useHostConversationTodos";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import { useSidebarWorkspaceStatus } from "../../providers/DashboardSidebarWorkspaceStatusProvider";
import { countOpenTodos, type OpenTodoCount } from "./countOpenTodos";

/** Null while unknown, or on a host too old to keep to-dos. */
export function useWorkspaceOpenTodos({
	workspaceId,
	hostId,
	enabled,
}: {
	workspaceId: string;
	hostId: string;
	enabled: boolean;
}): OpenTodoCount | null {
	const { bindings } = useSidebarWorkspaceStatus(workspaceId);
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: cache.resolveHostUrl(hostId);
	const includeAgentTodos = useSidebarPreference("showAgentTodos");
	// The per-host read every row shares.
	const { data } = useHostConversationTodos(
		hostUrl,
		enabled && bindings.size > 0,
	);
	return useMemo(() => {
		if (!data || bindings.size === 0) return null;
		return countOpenTodos({
			todos: data,
			workspaceId,
			liveTerminalIds: bindings,
			includeAgentTodos,
		});
	}, [data, bindings, workspaceId, includeAgentTodos]);
}
