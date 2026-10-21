import { Trans, useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import { CommandEmpty, CommandItem, CommandList } from "@superset/ui/command";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import { LuBot } from "react-icons/lu";
import { usePresetIcon } from "renderer/assets/app-icons/preset-icons";
import { useNow } from "renderer/hooks/useNow";
import { DOT_CLASS } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/DashboardSidebarConversationList";
import {
	type ConversationState,
	isWaitingOnUser,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useFrameStackStore } from "../../core/frames";
import { useCommandPaletteQuery } from "../CommandPalette/CommandPalette";
import {
	matchesSwitcherQuery,
	type SwitcherConversation,
} from "./switcher-conversations";
import { useSwitcherConversations } from "./useSwitcherConversations";

function AgentAvatar({
	conversation,
	label,
}: {
	conversation: SwitcherConversation;
	label: string;
}) {
	const iconUrl = usePresetIcon(conversation.agentId);
	return (
		<span className="relative flex w-4 shrink-0 items-center justify-center">
			{iconUrl ? (
				<img src={iconUrl} alt="" className="size-4 object-contain" />
			) : (
				<LuBot className="!size-4" />
			)}
			<span
				role="img"
				aria-label={label}
				className={cn(
					"absolute -right-1 -bottom-0.5 size-2 rounded-full ring-2 ring-popover",
					DOT_CLASS[conversation.state],
				)}
			/>
		</span>
	);
}

export function ConversationSwitcherFrame() {
	const { t } = useLingui();
	const query = useCommandPaletteQuery().trim();
	const conversations = useSwitcherConversations();
	// Minutes are the finest unit shown.
	const now = useNow(30_000).getTime();
	const navigate = useNavigate();
	const setOpen = useFrameStackStore((s) => s.setOpen);

	const stateLabel: Record<ConversationState, string> = {
		working: t`Working`,
		request: t`Needs your approval`,
		failed: t`Stopped on an error`,
		unseen: t`Finished — not opened yet`,
		seen: t`Waiting for your reply`,
		idle: t`Idle`,
	};

	const handleSelect = (conversation: SwitcherConversation) => {
		void navigateToV2Workspace(conversation.workspaceId, navigate, {
			search: {
				terminalId: conversation.terminalId,
				focusRequestId: crypto.randomUUID(),
			},
		});
		setOpen(false);
	};

	return (
		<CommandList>
			<CommandEmpty>
				<Trans>No conversations found.</Trans>
			</CommandEmpty>
			{conversations
				.filter((conversation) => matchesSwitcherQuery(conversation, query))
				.map((conversation) => (
					<CommandItem
						key={conversation.terminalId}
						value={`conversation ${conversation.terminalId}`}
						onSelect={() => handleSelect(conversation)}
						className="gap-2.5 !py-2.5 text-sm"
					>
						<AgentAvatar
							conversation={conversation}
							label={stateLabel[conversation.state]}
						/>
						<span className="min-w-0 flex-1 truncate font-normal">
							{conversation.title}
						</span>
						<span className="min-w-0 max-w-56 truncate text-muted-foreground text-xs">
							{conversation.projectName
								? `${conversation.projectName} · ${conversation.workspaceName}`
								: conversation.workspaceName}
						</span>
						{isWaitingOnUser(conversation.state) && (
							<span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
								{formatCompactRelativeTime(
									Math.min(conversation.since, now),
									now,
								)}
							</span>
						)}
					</CommandItem>
				))}
		</CommandList>
	);
}
