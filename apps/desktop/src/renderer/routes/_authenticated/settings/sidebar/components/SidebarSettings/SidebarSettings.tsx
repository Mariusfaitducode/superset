import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { Switch } from "@superset/ui/switch";
import {
	type SidebarPreferenceKey,
	useSidebarPreferencesStore,
	type WaitingTint,
} from "renderer/stores/sidebar-preferences";
import { SettingsRow } from "../../../components/SettingsRow";
import {
	isItemVisible,
	SETTING_ITEM_ID,
	type SettingItemId,
} from "../../../utils/settings-search";
import { SidebarAppearanceSettings } from "./components/SidebarAppearanceSettings";
import { WorkspaceLabelsSettings } from "./components/WorkspaceLabelsSettings";

interface SidebarSettingsProps {
	visibleItems: SettingItemId[];
}

export function SidebarSettings({ visibleItems }: SidebarSettingsProps) {
	const { t } = useLingui();
	const preferences = useSidebarPreferencesStore();
	const showAppearance = isItemVisible(
		SETTING_ITEM_ID.SIDEBAR_APPEARANCE,
		visibleItems,
	);
	const showStateColors = isItemVisible(
		SETTING_ITEM_ID.SIDEBAR_STATE_COLORS,
		visibleItems,
	);

	const rows: {
		itemId: SettingItemId;
		key: SidebarPreferenceKey;
		label: string;
		hint: string;
		/** Off when the conversation list itself is hidden. */
		needsConversations: boolean;
	}[] = [
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_CONVERSATIONS,
			key: "showConversations",
			label: t`Agent conversations`,
			hint: t`List each agent conversation under its workspace, with its state dot.`,
			needsConversations: false,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_IDLE_CONVERSATIONS,
			key: "showIdleConversations",
			label: t`Idle conversations`,
			hint: t`Also list agents that have not started working yet.`,
			needsConversations: true,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_CONVERSATION_STATS,
			key: "showConversationStats",
			label: t`Conversation stats`,
			hint: t`Show how much of the context window each conversation uses, with its model and tokens on hover.`,
			needsConversations: true,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_TURN_TIME,
			key: "showTurnTime",
			label: t`Working time`,
			hint: t`Show how long the current turn has been running.`,
			needsConversations: true,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_QUEUED_PROMPTS,
			key: "showQueuedPrompts",
			label: t`Queued messages`,
			hint: t`Show the messages that wait for the current turn to end.`,
			needsConversations: true,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_TODOS,
			key: "showTodos",
			label: t`Conversation to-dos`,
			hint: t`Show the to-do list of each conversation, shared with its agent.`,
			needsConversations: true,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_AGENT_TODOS,
			key: "showAgentTodos",
			label: t`Agents' to-dos`,
			hint: t`Also show the to-dos agents add to their conversation through the superset CLI.`,
			needsConversations: true,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_SUBAGENTS,
			key: "showSubagents",
			label: t`Subagents`,
			hint: t`List the subagents of each conversation under it.`,
			needsConversations: true,
		},
	];

	return (
		<div className="p-6 max-w-4xl w-full mx-auto">
			<div className="mb-8 flex items-start justify-between gap-6">
				<div>
					<h2 className="text-xl font-semibold">
						<Trans>Sidebar</Trans>
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						<Trans>
							Choose how the sidebar looks and what it shows under each
							workspace. Right-click a project or a group for its own options.
						</Trans>
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={preferences.reset}>
					<Trans>Reset to defaults</Trans>
				</Button>
			</div>
			{(showAppearance || showStateColors) && (
				<section className="mb-8">
					<h3 className="mb-1 text-sm font-semibold">
						<Trans>Appearance</Trans>
					</h3>
					<SidebarAppearanceSettings
						showLayout={showAppearance}
						showColors={showStateColors}
					/>
				</section>
			)}
			<h3 className="mb-1 text-sm font-semibold">
				<Trans>Content</Trans>
			</h3>
			<div className="divide-y divide-border">
				{rows
					.filter((row) => isItemVisible(row.itemId, visibleItems))
					.map((row) => (
						<SettingsRow
							key={row.key}
							label={row.label}
							hint={row.hint}
							htmlFor={`sidebar-${row.key}`}
						>
							<Switch
								id={`sidebar-${row.key}`}
								checked={preferences[row.key]}
								disabled={
									row.needsConversations && !preferences.showConversations
								}
								onCheckedChange={(checked) =>
									preferences.setPreference(row.key, checked)
								}
							/>
						</SettingsRow>
					))}
				{isItemVisible(SETTING_ITEM_ID.SIDEBAR_WAITING_TINT, visibleItems) && (
					<SettingsRow
						label={t`Waiting tint`}
						hint={t`Warm up a conversation after it waits for you 10 minutes, 1 hour and 4 hours.`}
						htmlFor="sidebar-waitingTint"
					>
						<Select
							value={preferences.waitingTint}
							disabled={!preferences.showConversations}
							onValueChange={(value) =>
								preferences.setWaitingTint(value as WaitingTint)
							}
						>
							<SelectTrigger id="sidebar-waitingTint" className="w-[140px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="off">
									<Trans>Off</Trans>
								</SelectItem>
								<SelectItem value="subtle">
									<Trans>Subtle</Trans>
								</SelectItem>
								<SelectItem value="strong">
									<Trans>Strong</Trans>
								</SelectItem>
							</SelectContent>
						</Select>
					</SettingsRow>
				)}
			</div>
			{isItemVisible(
				SETTING_ITEM_ID.SIDEBAR_WORKSPACE_LABELS,
				visibleItems,
			) && <WorkspaceLabelsSettings />}
		</div>
	);
}
