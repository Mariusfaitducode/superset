import {
	AGENT_IDENTITY_LABELS,
	type AgentIdentityId,
} from "@superset/shared/agent-catalog";
import { eq } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useSidebarWorkspaceStatus } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/providers/DashboardSidebarWorkspaceStatusProvider";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useV2NotificationStore } from "renderer/stores/v2-notifications";
import {
	type ConversationState,
	deriveConversationState,
} from "../utils/conversation-state";
import { pickConversationTitle } from "../utils/conversation-title";
import { terminalTabNames } from "../utils/terminal-tab-names";
import {
	hostTerminalTitlesQuery,
	hostTerminalTitlesQueryKey,
} from "./hostTerminalTitles";

export { cleanTitle } from "./hostTerminalTitles";

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
 * One entry per live agent in the workspace, oldest first. Titles come from
 * one read per host shared by every row, and only while some listed
 * workspace has agents.
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

	const queryClient = useQueryClient();
	const titlesQuery = useQuery({
		...hostTerminalTitlesQuery(hostUrl),
		enabled: enabled && hostUrl !== null && bindings.size > 0,
		// Agents retitle their terminal as the topic changes.
		refetchInterval: 15_000,
	});
	const titles = titlesQuery.data;

	// A new agent's title is read now rather than at the next poll.
	const bindingsKey = [...bindings.keys()].sort().join(",");
	const hasTitles = titles !== undefined;
	// biome-ignore lint/correctness/useExhaustiveDependencies: titles is read on a bindings change only
	useEffect(() => {
		if (!hasTitles || !bindingsKey || !titles) return;
		if (bindingsKey.split(",").every((id) => titles.has(id))) return;
		void queryClient.invalidateQueries(
			{ queryKey: hostTerminalTitlesQueryKey(hostUrl) },
			{ cancelRefetch: false },
		);
	}, [bindingsKey, hasTitles, hostUrl, queryClient]);

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
				title: pickConversationTitle({
					customTitle: titles?.get(binding.terminalId)?.customTitle ?? null,
					tabName: tabNames.get(binding.terminalId) ?? null,
					runtimeTitle: titles?.get(binding.terminalId)?.runtimeTitle ?? null,
					agentLabel: AGENT_IDENTITY_LABELS[binding.agentId] ?? binding.agentId,
				}),
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
