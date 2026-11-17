import { useMemo } from "react";
import {
	type ConversationMarkActions,
	useConversationMarkActions,
	useHostWorkStateSources,
} from "renderer/hooks/host-service/useHostConversationMarks";
import { useNow } from "renderer/hooks/useNow";
import { deriveWorkState, type WorkStateInfo } from "renderer/lib/agent-state";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useSidebarPreference } from "renderer/stores/sidebar-preferences";
import type { SidebarConversation } from "./useWorkspaceConversations";
import type { ConversationTodo } from "./useWorkspaceTodos";

export interface ConversationWorkStates {
	byTerminal: ReadonlyMap<string, WorkStateInfo>;
	/** False on hosts too old to keep pinned states. */
	canPin: boolean;
	actions: ConversationMarkActions;
}

/**
 * Each conversation's work state (waiting, working, to-dos, resume later,
 * done), from the same sources on every surface: its lifecycle, reports,
 * to-dos and the state pinned on the host. Workspace labels never decide it.
 */
export function useConversationWorkStates({
	hostId,
	conversations,
	todosByTerminal,
	enabled = true,
}: {
	hostId: string;
	conversations: readonly SidebarConversation[];
	todosByTerminal: ReadonlyMap<string, ConversationTodo[]> | null;
	enabled?: boolean;
}): ConversationWorkStates {
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: (cache.resolveHostUrl(hostId) ?? null);
	const sources = useHostWorkStateSources(
		hostUrl,
		enabled && conversations.length > 0,
	);
	const actions = useConversationMarkActions(hostUrl);
	const showAgentTodos = useSidebarPreference("showAgentTodos");
	// A silent turn turns "to check" without any new event.
	const now = useNow(60_000).getTime();

	const byTerminal = useMemo(() => {
		const map = new Map<string, WorkStateInfo>();
		for (const conversation of conversations) {
			const { terminalId } = conversation;
			const mark = sources.marks?.find(
				(item) => item.terminalId === terminalId,
			);
			map.set(
				terminalId,
				deriveWorkState({
					conversation: conversation.state,
					since: conversation.since,
					openTodos: (todosByTerminal?.get(terminalId) ?? []).filter(
						(todo) => !todo.done && (showAgentTodos || todo.author !== "agent"),
					).length,
					reports: (sources.reports ?? []).filter(
						(report) => report.terminalId === terminalId,
					),
					hasChildren: conversation.subagents.length > 0,
					now,
					mark: mark
						? { state: mark.state, setBy: mark.setBy, setAt: mark.setAt }
						: null,
				}),
			);
		}
		return map;
	}, [
		conversations,
		todosByTerminal,
		sources.marks,
		sources.reports,
		showAgentTodos,
		now,
	]);

	const canPin = sources.canPin;
	return useMemo(
		() => ({ byTerminal, canPin, actions }),
		[byTerminal, canPin, actions],
	);
}
