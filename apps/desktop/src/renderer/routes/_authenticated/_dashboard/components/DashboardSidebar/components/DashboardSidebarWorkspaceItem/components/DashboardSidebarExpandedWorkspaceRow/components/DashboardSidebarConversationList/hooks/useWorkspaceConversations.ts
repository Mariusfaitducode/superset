import {
	AGENT_IDENTITY_LABELS,
	type AgentIdentityId,
} from "@superset/shared/agent-catalog";
import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { useSidebarWorkspaceStatus } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useV2NotificationStore } from "renderer/stores/v2-notifications";
import {
	type ConversationState,
	deriveConversationState,
} from "../utils/conversation-state";
import { terminalTabNames } from "../utils/terminal-tab-names";

export interface SidebarSubagent {
	id: string;
	agentType?: string;
}

export interface SidebarConversation {
	terminalId: string;
	agentId: AgentIdentityId;
	title: string;
	subagents: SidebarSubagent[];
	state: ConversationState;
	/** Host clock, ms: when the conversation entered its current state. */
	since: number;
	/** Host clock, ms: when the current working turn began, if working. */
	turnStartedAt: number | null;
	startedAt: number;
	queuedPrompts: number;
}

// Agents prefix their terminal title with a spinner or status glyph; the
// conversation's state already shows, so the glyph is noise.
const LEADING_GLYPHS = /^[^\p{L}\p{N}~/.([{"'`]+/u;

function cleanTitle(title: string | null | undefined): string | null {
	const cleaned = title?.replace(LEADING_GLYPHS, "").trim();
	return cleaned ? cleaned : null;
}

/**
 * Every tool call re-stamps a working binding's `lastEventAt`, so the host no
 * longer knows when the turn began. Remember the first working stamp seen;
 * after an app restart mid-turn it is the first one seen since.
 */
const turnStarts = new Map<string, { startedAt: number; lastAt: number }>();

function trackTurnStart(
	terminalId: string,
	state: ConversationState,
	lastEventAt: number,
): number | null {
	if (state !== "working") {
		turnStarts.delete(terminalId);
		return null;
	}
	const known = turnStarts.get(terminalId);
	if (known && lastEventAt >= known.lastAt) {
		known.lastAt = lastEventAt;
		return known.startedAt;
	}
	turnStarts.set(terminalId, { startedAt: lastEventAt, lastAt: lastEventAt });
	return lastEventAt;
}

/**
 * One entry per live agent in the workspace, oldest first. The title is the
 * name the user gave the tab, else the session's name, else the title the
 * agent set. Host titles are read only for workspaces that have agents,
 * since the sidebar lists every workspace all day.
 */
export function useWorkspaceConversations({
	workspaceId,
	hostId,
	enabled = true,
}: {
	workspaceId: string;
	hostId: string;
	enabled?: boolean;
}): SidebarConversation[] {
	const { bindings } = useSidebarWorkspaceStatus(workspaceId);
	const terminalSeenAt = useV2NotificationStore(
		(state) => state.terminalSeenAt,
	);
	const collections = useCollections();
	const { data: localRows = [] } = useLiveQuery(
		(query) =>
			query
				.from({ state: collections.v2WorkspaceLocalState })
				.where(({ state }) => eq(state.workspaceId, workspaceId)),
		[collections, workspaceId],
	);
	const paneLayout = localRows[0]?.paneLayout;
	const tabNames = useMemo(() => terminalTabNames(paneLayout), [paneLayout]);

	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: cache.resolveHostUrl(hostId);

	const bindingsKey = [...bindings.keys()].sort().join(",");
	const titlesQuery = useQuery({
		queryKey: ["sidebar-conversation-titles", workspaceId, bindingsKey],
		enabled: enabled && hostUrl !== null && bindings.size > 0,
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
			const state = deriveConversationState({
				lastEventType: binding.lastEventType,
				lastEventAt: binding.lastEventAt,
				lastSeenAt: terminalSeenAt[binding.terminalId],
			});
			conversations.push({
				terminalId: binding.terminalId,
				agentId: binding.agentId,
				title:
					tabNames.get(binding.terminalId) ??
					titles?.get(binding.terminalId) ??
					AGENT_IDENTITY_LABELS[binding.agentId] ??
					binding.agentId,
				subagents: (binding.subagents ?? []).map((subagent) => ({
					id: subagent.id,
					...(subagent.agentType ? { agentType: subagent.agentType } : {}),
				})),
				state,
				since: binding.lastEventAt,
				turnStartedAt: trackTurnStart(
					binding.terminalId,
					state,
					binding.lastEventAt,
				),
				startedAt: binding.startedAt,
				queuedPrompts: binding.queuedPrompts ?? 0,
			});
		}
		conversations.sort((a, b) => a.startedAt - b.startedAt);
		return conversations;
	}, [bindings, terminalSeenAt, tabNames, titles]);
}
