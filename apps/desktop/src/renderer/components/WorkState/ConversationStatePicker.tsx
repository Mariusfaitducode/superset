import { useLingui } from "@lingui/react/macro";
import { errorMessage } from "@superset/i18n/errors";
import { toast } from "@superset/ui/sonner";
import type { ConversationWorkStates } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/hooks/useConversationWorkStates";
import { useHostAgentActions } from "renderer/routes/_authenticated/_dashboard/hosts/hooks/useHostAgentActions";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { WorkStatePicker } from "./WorkStatePicker";

/**
 * The state picker of one conversation, wired to its host: pins go to the
 * host so every view and agent reads them; "Close the agent" closes its
 * pane like the Hosts page does.
 */
export function ConversationStatePicker({
	workspaceId,
	hostId,
	terminalId,
	workStates,
	compact,
	className,
	onClosed,
}: {
	workspaceId: string;
	hostId: string;
	terminalId: string;
	workStates: ConversationWorkStates;
	compact?: boolean;
	className?: string;
	onClosed?: () => void;
}) {
	const { t } = useLingui();
	const { cache } = useHostWorkspaces();
	const hostUrl = cache.isSandboxHost(hostId)
		? null
		: (cache.resolveHostUrl(hostId) ?? null);
	const { stopAgent } = useHostAgentActions(hostUrl);
	const { actions, canPin } = workStates;

	const fail = (error: unknown) =>
		toast.error(t`Couldn't change the state`, {
			description: errorMessage(error),
		});

	return (
		<WorkStatePicker
			info={workStates.byTerminal.get(terminalId)}
			canPin={canPin}
			compact={compact}
			className={className}
			onPin={(state) =>
				void actions.set(workspaceId, terminalId, state).catch(fail)
			}
			onUnpin={() => void actions.clear(terminalId).catch(fail)}
			onCloseAgent={
				hostUrl
					? () => {
							void stopAgent(workspaceId, terminalId).then(() => {
								if (canPin) void actions.clear(terminalId).catch(() => {});
								onClosed?.();
							});
						}
					: undefined
			}
		/>
	);
}
