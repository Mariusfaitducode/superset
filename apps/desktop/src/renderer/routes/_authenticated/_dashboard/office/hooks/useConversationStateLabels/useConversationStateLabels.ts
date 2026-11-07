import { useLingui } from "@lingui/react/macro";
import type { ConversationState } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";

/** The sidebar's words for each state, so both views read the same. */
export function useConversationStateLabels(): Record<
	ConversationState,
	string
> {
	const { t } = useLingui();
	return {
		working: t`Working`,
		request: t`Needs your approval`,
		failed: t`Stopped on an error`,
		unseen: t`Finished — not opened yet`,
		seen: t`Waiting for your reply`,
		idle: t`Idle`,
	};
}
