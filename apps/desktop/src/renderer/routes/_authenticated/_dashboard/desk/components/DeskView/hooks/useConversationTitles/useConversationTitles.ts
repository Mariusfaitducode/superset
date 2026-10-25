import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { cleanTitle } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useWorkspaceConversations";
import type { DeskItem } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";

const pickTitles = (results: { data?: Map<string, string> }[]) =>
	results.map((result) => result.data);

/**
 * Terminal titles of the workspaces on the Desk, one read per workspace,
 * keyed by terminal id. A closed terminal has none.
 */
export function useConversationTitles(
	items: DeskItem[],
): ReadonlyMap<string, string> {
	const targetsKey = [
		...new Set(items.map((item) => `${item.hostUrl}\t${item.workspaceId}`)),
	]
		.sort()
		.join("\n");
	const targets = useMemo(
		() =>
			targetsKey
				? targetsKey.split("\n").map((entry) => {
						const [hostUrl = "", workspaceId = ""] = entry.split("\t");
						return { hostUrl, workspaceId };
					})
				: [],
		[targetsKey],
	);
	const results = useQueries({
		queries: targets.map(({ hostUrl, workspaceId }) => ({
			queryKey: ["desk-conversation-titles", hostUrl, workspaceId],
			queryFn: async () => {
				const { sessions } = await getHostServiceClientByUrl(
					hostUrl,
				).terminal.list.query({ workspaceId });
				const titles = new Map<string, string>();
				for (const session of sessions) {
					const title =
						cleanTitle(session.customTitle) ?? cleanTitle(session.title);
					if (title) titles.set(session.terminalId, title);
				}
				return titles;
			},
			staleTime: 30_000,
		})),
		combine: pickTitles,
	});
	return useMemo(() => {
		const titles = new Map<string, string>();
		for (const map of results) {
			for (const [terminalId, title] of map ?? [])
				titles.set(terminalId, title);
		}
		return titles;
	}, [results]);
}
