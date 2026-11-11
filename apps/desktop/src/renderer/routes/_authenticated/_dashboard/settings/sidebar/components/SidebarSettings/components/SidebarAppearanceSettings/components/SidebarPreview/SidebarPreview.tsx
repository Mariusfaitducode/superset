import { Trans, useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { LuBot, LuListChecks } from "react-icons/lu";
import {
	ACTIVE_MARKER_CLASS,
	conversationRowStyle,
	DOT_CLASS,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/DashboardSidebarConversationList";
import type { ConversationState } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import { useSidebarPreferencesStore } from "renderer/stores/sidebar-preferences";

const PREVIEW_PROJECT_COLOR = "#8b5cf6";
const PREVIEW_GROUP_COLOR = "#14b8a6";
const PREVIEW_PROJECT = "superset";

/** A fake sidebar drawn with the same CSS variables as the real one. */
export function SidebarPreview() {
	const { t } = useLingui();
	const contrast = useSidebarPreferencesStore((state) => state.contrast);
	const activeMarker = useSidebarPreferencesStore(
		(state) => state.activeMarker,
	);
	const folderColorOn = useSidebarPreferencesStore(
		(state) => state.folderColorOnConversations,
	);

	const workspaces: {
		name: string;
		color: string;
		conversations: {
			title: string;
			state: ConversationState;
			active?: boolean;
			time?: string;
			todos?: number;
		}[];
	}[] = [
		{
			name: "sidebar-appearance",
			color: PREVIEW_PROJECT_COLOR,
			conversations: [
				{ title: t`Build the settings page`, state: "working", time: "4m" },
				{
					title: t`Review the pull request`,
					state: "request",
					active: true,
					time: "12m",
				},
				{ title: t`Fix the flaky test`, state: "unseen", time: "1h" },
			],
		},
		{
			name: "handy-meetings",
			color: PREVIEW_GROUP_COLOR,
			conversations: [
				{ title: t`Calendar sync`, state: "seen", time: "3h", todos: 2 },
				{ title: t`Release notes`, state: "failed", time: "5m" },
				{ title: t`Explore the codebase`, state: "idle" },
			],
		},
	];

	return (
		<div
			data-sb-contrast={contrast}
			className="w-[260px] overflow-hidden rounded-lg border border-border bg-sidebar py-2 shadow-sm dark:bg-muted/35"
			aria-hidden
		>
			<div className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.075em] text-muted-foreground">
				<Trans>Preview</Trans>
			</div>
			<div className="mx-2 flex h-[var(--sb-row-h)] items-center gap-2 rounded-md pl-2 text-[13px] font-medium">
				<span
					className="size-4 rounded"
					style={{ backgroundColor: PREVIEW_PROJECT_COLOR }}
				/>
				<span className="truncate">{PREVIEW_PROJECT}</span>
			</div>
			{workspaces.map((workspace) => (
				<div key={workspace.name}>
					<div className="mx-2 flex h-[var(--sb-row-h)] items-center gap-2 rounded-md pl-6 text-sm text-muted-foreground">
						<span className="truncate">{workspace.name}</span>
					</div>
					<ul className="flex flex-col pr-2 pb-1 pl-[38px]">
						{workspace.conversations.map((conversation) => {
							const folderColor = folderColorOn ? workspace.color : null;
							const waiting =
								conversation.state === "request" ||
								conversation.state === "unseen" ||
								conversation.state === "seen" ||
								conversation.state === "failed";
							return (
								<li
									key={conversation.title}
									className={cn(
										"flex h-[var(--sb-conv-h)] items-center gap-2 rounded-sm border border-transparent pr-1 pl-1",
										folderColor && "pl-[calc(var(--sb-band)+4px)]",
										conversation.active && ACTIVE_MARKER_CLASS[activeMarker],
									)}
									style={conversationRowStyle({
										isActive: conversation.active === true,
										activeMarker,
										folderColor,
									})}
								>
									<span className="relative flex size-3.5 shrink-0 items-center justify-center">
										<LuBot className="size-3.5" />
										<span
											className={cn(
												"absolute -right-1 -bottom-0.5 size-2 rounded-full ring-2 ring-sidebar",
												DOT_CLASS[conversation.state],
											)}
										/>
									</span>
									<span
										className={cn(
											"min-w-0 flex-1 truncate text-[length:var(--sb-conv-text)]",
											waiting || conversation.state === "working"
												? "text-foreground"
												: "text-muted-foreground",
										)}
									>
										{conversation.title}
									</span>
									{conversation.todos ? (
										<span className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground">
											<LuListChecks className="size-3" />
											{conversation.todos}
										</span>
									) : null}
									{conversation.time ? (
										<span
											className={cn(
												"shrink-0 text-[10px] tabular-nums",
												conversation.state === "working"
													? "text-[color:var(--sb-state-working)]"
													: "text-muted-foreground",
											)}
										>
											{conversation.time}
										</span>
									) : null}
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</div>
	);
}
