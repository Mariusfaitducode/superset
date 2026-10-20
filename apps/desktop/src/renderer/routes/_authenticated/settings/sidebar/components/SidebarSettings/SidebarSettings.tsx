import { Trans, useLingui } from "@lingui/react/macro";
import { Switch } from "@superset/ui/switch";
import {
	type SidebarPreferenceKey,
	useSidebarPreferencesStore,
} from "renderer/stores/sidebar-preferences";
import { SettingsRow } from "../../../components/SettingsRow";
import {
	isItemVisible,
	SETTING_ITEM_ID,
	type SettingItemId,
} from "../../../utils/settings-search";

interface SidebarSettingsProps {
	visibleItems: SettingItemId[];
}

export function SidebarSettings({ visibleItems }: SidebarSettingsProps) {
	const { t } = useLingui();
	const preferences = useSidebarPreferencesStore();

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
			itemId: SETTING_ITEM_ID.SIDEBAR_CONVERSATION_STATS,
			key: "showConversationStats",
			label: t`Conversation stats`,
			hint: t`Show how much of the context window each conversation uses, with its model and tokens on hover.`,
			needsConversations: true,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_TODOS,
			key: "showTodos",
			label: t`Conversation to-dos`,
			hint: t`Show the to-do button and list on each conversation.`,
			needsConversations: true,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_SUBAGENTS,
			key: "showSubagents",
			label: t`Subagents`,
			hint: t`List the subagents of each conversation under it.`,
			needsConversations: true,
		},
		{
			itemId: SETTING_ITEM_ID.SIDEBAR_WAITING_TINT,
			key: "showWaitingTint",
			label: t`Waiting tint`,
			hint: t`Warm up a conversation the longer it waits for you.`,
			needsConversations: true,
		},
	];

	return (
		<div className="p-6 max-w-4xl w-full mx-auto">
			<div className="mb-8">
				<h2 className="text-xl font-semibold">
					<Trans>Sidebar</Trans>
				</h2>
				<p className="text-sm text-muted-foreground mt-1">
					<Trans>Choose what the sidebar shows under each workspace.</Trans>
				</p>
			</div>
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
			</div>
		</div>
	);
}
