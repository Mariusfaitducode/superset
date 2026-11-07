import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { HotkeyId } from "renderer/hotkeys";

/**
 * The pages at the top of the sidebar, in order. Adding one takes an id here,
 * its label and shortcut below, and its entry in the header's
 * `SIDEBAR_NAV_ENTRIES` (icon, route, badge). Settings → Sidebar → Menu
 * lists it on its own.
 */
export const SIDEBAR_NAV_ITEMS = [
	"search",
	"workspaces",
	"desk",
	"hosts",
	"cloudWorkspaces",
	"projects",
	"automations",
	"myAutomations",
	"tasks",
	"pullRequests",
	"gitGraph",
	"insights",
	"office",
	"usage",
	"pages",
	"notes",
	"plugins",
] as const;

export type SidebarNavItemId = (typeof SIDEBAR_NAV_ITEMS)[number];

export const NAV_ITEM_LABEL: Record<SidebarNavItemId, MessageDescriptor> = {
	search: msg`Search`,
	workspaces: msg`Workspaces`,
	desk: msg({ message: "Needs you", context: "desk page" }),
	hosts: msg`Hosts`,
	cloudWorkspaces: msg`Cloud workspaces`,
	projects: msg`Projects`,
	automations: msg`Automations`,
	myAutomations: msg`My automations`,
	tasks: msg`Tasks`,
	pullRequests: msg`Pull requests`,
	gitGraph: msg`Git graph`,
	insights: msg`Insights`,
	office: msg`Office`,
	usage: msg`Usage`,
	pages: msg`Pages`,
	notes: msg`Notes`,
	plugins: msg`Plugins`,
};

/** A page may have no shortcut. */
export const NAV_ITEM_HOTKEY: Partial<Record<SidebarNavItemId, HotkeyId>> = {
	search: "OPEN_COMMAND_PALETTE",
	workspaces: "OPEN_WORKSPACES_PAGE",
	cloudWorkspaces: "OPEN_CLOUD_WORKSPACES_PAGE",
	projects: "OPEN_PROJECTS_PAGE",
	automations: "OPEN_AUTOMATIONS_PAGE",
	tasks: "OPEN_TASKS_PAGE",
	pullRequests: "OPEN_PULL_REQUESTS_PAGE",
	usage: "OPEN_USAGE_PAGE",
	pages: "OPEN_PAGES_PAGE",
	notes: "OPEN_NOTES_PAGE",
	plugins: "OPEN_PLUGINS_PAGE",
};
