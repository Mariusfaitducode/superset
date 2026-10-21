import { Trans, useLingui } from "@lingui/react/macro";
import { formatCompactRelativeTime } from "@superset/i18n/format";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@superset/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LuBot } from "react-icons/lu";
import { usePresetIcon } from "renderer/assets/app-icons/preset-icons";
import {
	type AgentConversation,
	useAgentConversations,
} from "renderer/hooks/useAgentConversations";
import { useIsV2CloudEnabled } from "renderer/hooks/useIsV2CloudEnabled";
import { useNow } from "renderer/hooks/useNow";
import { useHotkey } from "renderer/hotkeys";
import { DOT_CLASS } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/DashboardSidebarConversationList";
import {
	type ConversationState,
	isWaitingOnUser,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import { navigateToV2Workspace } from "renderer/routes/_authenticated/_dashboard/utils/workspace-navigation";
import { useConversationRecencyStore } from "renderer/stores/conversation-recency";
import { useVisibleTerminalsStore } from "renderer/stores/visible-terminals";
import {
	arrangeConversations,
	type SwitcherSectionId,
} from "./arrange-conversations";
import { useConversationSwitcherStore } from "./store";

/**
 * ⌘K: jump to any agent conversation. Opens on the conversation that was on
 * screen before this one, so ⌘K ↵ flips between two agents.
 */
export function ConversationSwitcher() {
	const isV2CloudEnabled = useIsV2CloudEnabled();
	const open = useConversationSwitcherStore((state) => state.open);
	const setOpen = useConversationSwitcherStore((state) => state.setOpen);
	const currentTerminalId = useVisibleTerminalsStore(
		(state) => state.terminalIdBySlot.center ?? null,
	);
	const touch = useConversationRecencyStore((state) => state.touch);

	useEffect(() => {
		if (currentTerminalId) touch(currentTerminalId);
	}, [currentTerminalId, touch]);

	useHotkey("OPEN_CONVERSATION_SWITCHER", () => {
		if (isV2CloudEnabled) setOpen(!open);
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				showCloseButton={false}
				className="!max-w-[640px] sm:!max-w-[640px] translate-y-0 gap-0 overflow-hidden p-0"
				style={{ top: "max(16px, calc(50% - 260px))" }}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>
						<Trans>Go to Conversation</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>Jump to any agent conversation, in any workspace</Trans>
					</DialogDescription>
				</DialogHeader>
				{open && (
					<SwitcherContent
						currentTerminalId={currentTerminalId}
						onClose={() => setOpen(false)}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

function SwitcherContent({
	currentTerminalId,
	onClose,
}: {
	currentTerminalId: string | null;
	onClose: () => void;
}) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const conversations = useAgentConversations();
	const recent = useConversationRecencyStore((state) => state.recent);
	// Minutes are the finest unit shown.
	const now = useNow(30_000).getTime();
	const [query, setQuery] = useState("");
	const sections = useMemo(
		() =>
			arrangeConversations({
				conversations,
				recent,
				currentTerminalId,
				query,
			}),
		[conversations, recent, currentTerminalId, query],
	);

	// cmdk keeps its highlight on a row that moved; restart from the top
	// whenever the list is re-ranked by typing.
	const firstId = sections[0]?.conversations[0]?.terminalId ?? "";
	const [selected, setSelected] = useState(firstId);
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on a new query only
	useEffect(() => {
		setSelected(firstId);
	}, [query]);
	useEffect(() => {
		if (!selected && firstId) setSelected(firstId);
	}, [selected, firstId]);

	const headings: Record<SwitcherSectionId, string> = {
		recent: t`Recent`,
		needsYou: t`Needs you`,
		others: t`Others`,
		results: t`Results`,
	};
	const stateLabel: Record<ConversationState, string> = {
		working: t`Working`,
		request: t`Needs your approval`,
		failed: t`Stopped on an error`,
		unseen: t`Finished — not opened yet`,
		seen: t`Waiting for your reply`,
		idle: t`Idle`,
	};

	const openConversation = (conversation: AgentConversation) => {
		onClose();
		void navigateToV2Workspace(conversation.workspaceId, navigate, {
			search: {
				terminalId: conversation.terminalId,
				focusRequestId: crypto.randomUUID(),
			},
		});
	};

	return (
		<Command
			shouldFilter={false}
			loop
			value={selected}
			onValueChange={setSelected}
			className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-1.5 **:data-[slot=command-input-wrapper]:h-12"
		>
			<CommandInput
				value={query}
				onValueChange={setQuery}
				placeholder={t`Search conversations…`}
				className="h-12 text-[15px]"
			/>
			<CommandList className="max-h-[min(440px,calc(80vh-6rem))] pb-1.5">
				<CommandEmpty>
					{conversations.length === 0 ? (
						<Trans>No agent conversations yet.</Trans>
					) : (
						<Trans>No conversations found.</Trans>
					)}
				</CommandEmpty>
				{sections.map((section) => (
					<CommandGroup key={section.id} heading={headings[section.id]}>
						{section.conversations.map((conversation) => (
							<ConversationRow
								key={conversation.terminalId}
								conversation={conversation}
								stateLabel={stateLabel[conversation.state]}
								now={now}
								isCurrent={conversation.terminalId === currentTerminalId}
								onSelect={() => openConversation(conversation)}
							/>
						))}
					</CommandGroup>
				))}
			</CommandList>
			<div className="flex items-center gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground">
				<span>
					<Kbd>↑↓</Kbd> <Trans>Move</Trans>
				</span>
				<span>
					<Kbd>↵</Kbd> <Trans>Open</Trans>
				</span>
				<span>
					<Kbd>esc</Kbd> <Trans>Close</Trans>
				</span>
				<span className="ml-auto">
					<Trans>⌘K ↵ goes back to the previous conversation</Trans>
				</span>
			</div>
		</Command>
	);
}

function Kbd({ children }: { children: string }) {
	return (
		<kbd className="rounded border bg-muted px-1 font-sans text-[10px]">
			{children}
		</kbd>
	);
}

function ConversationRow({
	conversation,
	stateLabel,
	now,
	isCurrent,
	onSelect,
}: {
	conversation: AgentConversation;
	stateLabel: string;
	now: number;
	isCurrent: boolean;
	onSelect: () => void;
}) {
	const { t } = useLingui();
	const iconUrl = usePresetIcon(conversation.agentId);
	const place = conversation.projectName
		? `${conversation.projectName} › ${conversation.workspaceName}`
		: conversation.workspaceName;
	return (
		<CommandItem
			value={conversation.terminalId}
			onSelect={onSelect}
			className="gap-3 rounded-md px-2 py-1.5"
		>
			<span className="relative flex size-5 shrink-0 items-center justify-center">
				{iconUrl ? (
					<img src={iconUrl} alt="" className="size-5 object-contain" />
				) : (
					<LuBot className="!size-5" />
				)}
				<span
					role="img"
					aria-label={stateLabel}
					className={cn(
						"absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-popover",
						DOT_CLASS[conversation.state],
					)}
				/>
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-[13px] text-foreground">
					{conversation.title}
				</span>
				<span className="truncate text-[11px] text-muted-foreground">
					{isCurrent ? `${place} · ${t`On screen`}` : place}
				</span>
			</span>
			<span className="flex shrink-0 flex-col items-end text-[11px] text-muted-foreground">
				<span>{stateLabel}</span>
				{isWaitingOnUser(conversation.state) && (
					<span className="tabular-nums">
						{formatCompactRelativeTime(Math.min(conversation.since, now), now)}
					</span>
				)}
			</span>
		</CommandItem>
	);
}
