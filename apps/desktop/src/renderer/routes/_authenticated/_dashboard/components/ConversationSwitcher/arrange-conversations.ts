import {
	type AgentConversation,
	matchesConversationQuery,
} from "renderer/hooks/useAgentConversations";
import { isWaitingOnUser } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";

export type SwitcherSectionId = "recent" | "needsYou" | "others" | "results";

export interface SwitcherSection {
	id: SwitcherSectionId;
	conversations: AgentConversation[];
}

// Enough to flip between the agents in hand without hiding who needs you.
const RECENT_LIMIT = 4;

/**
 * Without a query: the conversations last on screen first, so ⌘K ↵ flips
 * back to the previous one, then those waiting on the user, then the rest.
 * The conversation on screen is left out. With a query: one ranked list.
 */
export function arrangeConversations({
	conversations,
	recent,
	currentTerminalId,
	query,
}: {
	/** Waiting on the user first, most recent state change first. */
	conversations: AgentConversation[];
	/** Terminal ids, most recently on screen first. */
	recent: readonly string[];
	currentTerminalId: string | null;
	query: string;
}): SwitcherSection[] {
	const recencyRank = new Map(recent.map((id, index) => [id, index]));
	const trimmed = query.trim();
	if (trimmed) {
		const results = conversations
			.filter((conversation) => matchesConversationQuery(conversation, trimmed))
			.map((conversation) => ({
				conversation,
				score: titleScore(conversation.title, trimmed),
				rank: recencyRank.get(conversation.terminalId) ?? recent.length,
			}))
			.sort((a, b) => b.score - a.score || a.rank - b.rank)
			.map(({ conversation }) => conversation);
		return results.length ? [{ id: "results", conversations: results }] : [];
	}

	const byId = new Map(
		conversations.map((conversation) => [
			conversation.terminalId,
			conversation,
		]),
	);
	const recentConversations = recent
		.filter((id) => id !== currentTerminalId)
		.flatMap((id) => byId.get(id) ?? [])
		.slice(0, RECENT_LIMIT);
	const shown = new Set([
		currentTerminalId,
		...recentConversations.map((conversation) => conversation.terminalId),
	]);
	const rest = conversations.filter(
		(conversation) => !shown.has(conversation.terminalId),
	);
	const sections: SwitcherSection[] = [
		{ id: "recent", conversations: recentConversations },
		{
			id: "needsYou",
			conversations: rest.filter((c) => isWaitingOnUser(c.state)),
		},
		{
			id: "others",
			conversations: rest.filter((c) => !isWaitingOnUser(c.state)),
		},
	];
	return sections.filter((section) => section.conversations.length > 0);
}

/** A title that starts with the query beats one with a word starting with it. */
function titleScore(title: string, query: string): number {
	const lowerTitle = title.toLowerCase();
	const lowerQuery = query.toLowerCase();
	if (lowerTitle.startsWith(lowerQuery)) return 2;
	const firstWord = lowerQuery.split(/\s+/)[0] ?? "";
	return lowerTitle
		.split(/[\s/._-]+/)
		.some((word) => word.startsWith(firstWord))
		? 1
		: 0;
}
