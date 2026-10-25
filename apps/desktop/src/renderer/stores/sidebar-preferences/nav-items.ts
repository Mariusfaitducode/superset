import type { HotkeyId } from "renderer/hotkeys";

export const SIDEBAR_NAV_ITEMS = [
	"search",
	"workspaces",
	"cloudWorkspaces",
	"projects",
	"automations",
	"tasks",
	"pullRequests",
	"usage",
	"pages",
	"notes",
	"plugins",
] as const;

export type SidebarNavItemId = (typeof SIDEBAR_NAV_ITEMS)[number];

export const NAV_ITEM_HOTKEY: Record<SidebarNavItemId, HotkeyId> = {
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
