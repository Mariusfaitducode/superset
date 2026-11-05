import { Trans, useLingui } from "@lingui/react/macro";
import { FEATURE_FLAGS } from "@superset/shared/constants";
import { Button } from "@superset/ui/button";
import { Switch } from "@superset/ui/switch";
import { Link } from "@tanstack/react-router";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { env } from "renderer/env.renderer";
import { HotkeyLabel } from "renderer/hotkeys";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { SettingsRow } from "renderer/routes/_authenticated/settings/components/SettingsRow";
import {
	NAV_ITEM_HOTKEY,
	NAV_ITEM_LABEL,
	SIDEBAR_NAV_ITEMS,
	type SidebarNavItemId,
	useSidebarPreferencesStore,
} from "renderer/stores/sidebar-preferences";

/** Which entries the menu at the top of the sidebar lists, and their shortcuts. */
export function SidebarMenuSettings() {
	const { t, i18n } = useLingui();
	const hiddenNavItems = useSidebarPreferencesStore(
		(state) => state.hiddenNavItems,
	);
	const setNavItemVisible = useSidebarPreferencesStore(
		(state) => state.setNavItemVisible,
	);
	const keepSidebarInSettings = useSidebarPreferencesStore(
		(state) => state.keepSidebarInSettings,
	);
	const navItemsAsIcons = useSidebarPreferencesStore(
		(state) => state.navItemsAsIcons,
	);
	const setPreference = useSidebarPreferencesStore(
		(state) => state.setPreference,
	);
	const isCloudEnabled =
		useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES) === true;
	const isPluginsEnabled =
		(useFeatureFlagEnabled(FEATURE_FLAGS.PLUGINS) ?? false) ||
		env.NODE_ENV === "development";

	const utils = electronTrpc.useUtils();
	const { data: usageInSidebar } =
		electronTrpc.settings.getShowUsageInSidebar.useQuery();
	const setUsageInSidebar =
		electronTrpc.settings.setShowUsageInSidebar.useMutation({
			onSettled: () => utils.settings.getShowUsageInSidebar.invalidate(),
		});

	// Pages from other features are available unless listed here.
	const availability: Partial<Record<SidebarNavItemId, boolean>> = {
		cloudWorkspaces: isCloudEnabled,
		projects: isCloudEnabled,
		plugins: isPluginsEnabled,
	};
	const items = SIDEBAR_NAV_ITEMS.map((id) => ({
		id,
		label: i18n._(NAV_ITEM_LABEL[id]),
		available: availability[id] ?? true,
	}));

	const isShown = (id: SidebarNavItemId) =>
		id === "usage"
			? usageInSidebar === true && !hiddenNavItems.includes(id)
			: !hiddenNavItems.includes(id);
	const setShown = (id: SidebarNavItemId, shown: boolean) => {
		setNavItemVisible(id, shown);
		if (id === "usage") setUsageInSidebar.mutate({ enabled: shown });
	};

	return (
		<>
			<SettingsRow
				label={t`Keep the sidebar in Settings`}
				hint={t`Show the workspace sidebar on the left while Settings is open.`}
				htmlFor="sidebar-keepSidebarInSettings"
			>
				<Switch
					id="sidebar-keepSidebarInSettings"
					checked={keepSidebarInSettings}
					onCheckedChange={(checked) =>
						setPreference("keepSidebarInSettings", checked)
					}
				/>
			</SettingsRow>
			<SettingsRow
				label={t`Pages as an icon bar`}
				hint={t`Show the pages below Search as one row of icons, with their counts, instead of a row each.`}
				htmlFor="sidebar-navItemsAsIcons"
			>
				<Switch
					id="sidebar-navItemsAsIcons"
					checked={navItemsAsIcons}
					onCheckedChange={(checked) =>
						setPreference("navItemsAsIcons", checked)
					}
				/>
			</SettingsRow>
			<div className="flex items-center justify-between gap-6 py-2.5">
				<p className="text-xs text-muted-foreground">
					<Trans>
						Pick the entries of the menu at the top of the sidebar. Their
						shortcuts work even when an entry is hidden.
					</Trans>
				</p>
				<Button variant="outline" size="sm" asChild>
					<Link to="/settings/keyboard">
						<Trans>Change shortcuts</Trans>
					</Link>
				</Button>
			</div>
			<ul className="mb-2.5 divide-y divide-border rounded-md border border-border">
				{items
					.filter((item) => item.available)
					.map((item) => (
						<li
							key={item.id}
							className="flex h-9 items-center justify-between gap-4 px-3 text-sm"
						>
							<label
								htmlFor={`sidebar-nav-${item.id}`}
								className="min-w-0 flex-1 truncate"
							>
								{item.label}
							</label>
							<span className="text-xs text-muted-foreground">
								<HotkeyLabel id={NAV_ITEM_HOTKEY[item.id]} />
							</span>
							<Switch
								id={`sidebar-nav-${item.id}`}
								checked={isShown(item.id)}
								disabled={item.id === "usage" && usageInSidebar === undefined}
								onCheckedChange={(checked) => setShown(item.id, checked)}
							/>
						</li>
					))}
			</ul>
		</>
	);
}
