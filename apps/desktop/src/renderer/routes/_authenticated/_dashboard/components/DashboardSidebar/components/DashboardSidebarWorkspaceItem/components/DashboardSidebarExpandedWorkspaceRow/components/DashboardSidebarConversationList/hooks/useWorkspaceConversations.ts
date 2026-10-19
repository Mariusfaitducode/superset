import { AGENT_IDENTITY_LABELS } from "@superset/shared/agent-catalog";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { useSidebarWorkspaceStatus } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useV2NotificationStore } from "renderer/stores/v2-notifications";
import {
	type ConversationState,
	deriveConversationState,
} from "../utils/conversation-state";

export interface SidebarConversation {
	terminalId: string;
	title: string;
	state: ConversationState;
	/** Host clock, ms: when the conversation entered its current state. */
	since: number;
	startedAt: number;
}

// Agents prefix their terminal title with a spinner or status glyph; the
// conversation's state already shows, so the glyph is noise.
const LEADING_GLYPHS = /^[^\p{L}\p{N}~/.([{"'`]+/u;

function cleanTitle(title: string | null | undefined): string | null {
	const cleaned = title?.replace(LEADING_GLYPHS, "").trim();
	return cleaned ? cleaned : null;
}

/**
 * One entry per live agent in the workspace, oldest first. Titles come from
 * the host's terminal sessions (the user's rename wins over the title the
 * agent sets); they are read only for workspaces that have agents, since the
 * sidebar lists every workspace all day.
 */
export function useWorkspaceConversations({
	workspaceId,
	hostId,
}: {
	workspaceId: string;
	hostId: string;
}): SidebarConversation[] {
	const { bindings } = useSidebarWorkspaceStatus(workspaceId);
	const terminalSeenAt = useV2NotificationStore(
		(state) => state.terminalSeenAt,
	);
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: cache.resolveHostUrl(hostId);

	const bindingsKey = [...bindings.keys()].sort().join(",");
	const titlesQuery = useQuery({
		queryKey: ["sidebar-conversation-titles", workspaceId, bindingsKey],
		enabled: hostUrl !== null && bindings.size > 0,
		queryFn: async () => {
			if (!hostUrl) return new Map<string, string | null>();
			const { sessions } = await getHostServiceClientByUrl(
				hostUrl,
			).terminal.list.query({ workspaceId });
			return new Map(
				sessions.map((session) => [
					session.terminalId,
					cleanTitle(session.customTitle) ?? cleanTitle(session.title),
				]),
			);
		},
		// Agents retitle their terminal as the topic changes.
		refetchInterval: 15_000,
		staleTime: 10_000,
	});
	const titles = titlesQuery.data;

	return useMemo(() => {
		const conversations: SidebarConversation[] = [];
		for (const binding of bindings.values()) {
			const agentLabel =
				AGENT_IDENTITY_LABELS[binding.agentId] ?? binding.agentId;
			conversations.push({
				terminalId: binding.terminalId,
				title: titles?.get(binding.terminalId) ?? agentLabel,
				state: deriveConversationState({
					lastEventType: binding.lastEventType,
					lastEventAt: binding.lastEventAt,
					lastSeenAt: terminalSeenAt[binding.terminalId],
				}),
				since: binding.lastEventAt,
				startedAt: binding.startedAt,
			});
		}
		conversations.sort((a, b) => a.startedAt - b.startedAt);
		return conversations;
	}, [bindings, terminalSeenAt, titles]);
}
