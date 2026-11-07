import { useLingui } from "@lingui/react/macro";
import { FEATURE_FLAGS } from "@superset/shared/constants";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useFeatureFlagEnabled } from "posthog-js/react";
import type { ComponentType } from "react";
import { GoGitPullRequest } from "react-icons/go";
import { HiOutlineClipboardDocumentList } from "react-icons/hi2";
import {
	LuActivity,
	LuBuilding2,
	LuClock,
	LuCloud,
	LuFileText,
	LuGauge,
	LuGitGraph,
	LuInbox,
	LuLayers,
	LuPuzzle,
	LuServer,
	LuStickyNote,
	LuWorkflow,
} from "react-icons/lu";
import { GATED_FEATURES, usePaywall } from "renderer/components/Paywall";
import { env } from "renderer/env.renderer";
import { cloudTrpc } from "renderer/lib/cloud-trpc";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { ProjectGlyph } from "renderer/routes/_authenticated/_dashboard/components/TaskProjectIcon";
import { useDeskQueue } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";
import { useFailedAutomations } from "renderer/routes/_authenticated/_dashboard/hooks/useFailedAutomations";
import {
	pullRequestsSearchFromFilters,
	usePullRequestsFilterStore,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/stores/pullRequestsFilterStore";
import {
	tasksSearchFromFilters,
	useTasksFilterStore,
} from "renderer/routes/_authenticated/_dashboard/tasks/stores/tasks-filter-state";
import {
	getUsageLastSection,
	usageSectionPath,
} from "renderer/routes/_authenticated/settings/usage/utils/usageLastSection";
import type { SidebarNavItemId } from "renderer/stores/sidebar-preferences";

export interface SidebarNavBadge {
	count: number;
	/** `alert` is red (something failed); `attention` is the needs-you color. */
	tone: "alert" | "attention";
	title: string;
	/** Opens something more precise than the page itself. */
	onClick?: () => void;
}

export interface SidebarNavTarget {
	/** False when the account or build has no such page. */
	available: boolean;
	isActive: boolean;
	onClick: () => void;
	badge?: SidebarNavBadge | null;
}

export interface SidebarNavEntry {
	id: Exclude<SidebarNavItemId, "search">;
	icon: ComponentType<{ className?: string; strokeWidth?: number }>;
	/** Lucide icons look right thinner; the others ignore it. */
	thinStroke?: boolean;
	/** Called once per render of the entry, so it may use hooks. */
	useTarget: () => SidebarNavTarget;
}

type SimplePageRoute =
	| "/cloud-workspaces"
	| "/projects"
	| "/pages"
	| "/notes"
	| "/plugins"
	| "/git-graph"
	| "/insights"
	| "/office"
	| "/relais"
	| "/hosts";

function useRoutePage(
	to: SimplePageRoute,
): Pick<SidebarNavTarget, "isActive" | "onClick"> {
	const matchRoute = useMatchRoute();
	const navigate = useNavigate();
	return {
		isActive: !!matchRoute({ to, fuzzy: true }),
		onClick: () => navigate({ to }),
	};
}

function useCloudEnabled(): boolean {
	return useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES) === true;
}

export function usePluginsEnabled(): boolean {
	// `?? false`: undefined until PostHog flags resolve. Dev builds bypass the
	// flag: the local dev account isn't in the @superset.sh release condition.
	return (
		(useFeatureFlagEnabled(FEATURE_FLAGS.PLUGINS) ?? false) ||
		env.NODE_ENV === "development"
	);
}

function useAutomationsTarget(): SidebarNavTarget {
	const { t } = useLingui();
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const { gateFeature, hasAccess } = usePaywall();
	const cloudUtils = cloudTrpc.useUtils();
	const { myFailedCount } = useFailedAutomations();
	// Automations are Pro, but an org that already has some (a downgrade) can
	// still reach the list to pause, edit, or delete them; the page gates the
	// actions that need the plan. A Free org with none meets the paywall here.
	// If the list can't be read the answer is unknown, so let the click
	// through: an empty list page gates every action itself.
	const open = async () => {
		if (hasAccess(GATED_FEATURES.AUTOMATIONS)) {
			navigate({ to: "/automations" });
			return;
		}
		const automations = await cloudUtils.automation.list
			.fetch()
			.catch(() => null);
		if (automations === null || automations.length > 0) {
			navigate({ to: "/automations" });
			return;
		}
		gateFeature(GATED_FEATURES.AUTOMATIONS, () => {
			navigate({ to: "/automations" });
		});
	};
	return {
		available: true,
		isActive: !!matchRoute({ to: "/automations", fuzzy: true }),
		onClick: () => void open(),
		badge:
			myFailedCount > 0
				? {
						count: myFailedCount,
						tone: "alert",
						title: t`${myFailedCount} of your automations failed their last run`,
						onClick: () =>
							navigate({
								to: "/automations/runs",
								search: { status: "failed", scope: "mine" },
							}),
					}
				: null,
	};
}

function useTasksTarget(): SidebarNavTarget {
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const { gateFeature } = usePaywall();
	const filters = useTasksFilterStore();
	return {
		available: true,
		isActive: !!matchRoute({ to: "/tasks", fuzzy: true }),
		onClick: () =>
			gateFeature(GATED_FEATURES.TASKS, () => {
				navigate({
					to: "/tasks",
					search: tasksSearchFromFilters({
						tab: filters.tab,
						assignee: filters.assignee,
						label: filters.label,
						search: filters.search,
						typeTab: filters.typeTab,
						projectFilters: filters.projectFilters,
						includeClosedIssues: filters.includeClosedIssues,
					}),
				});
			}),
	};
}

function usePullRequestsTarget(): SidebarNavTarget {
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const filters = usePullRequestsFilterStore();
	return {
		available: true,
		isActive: !!matchRoute({ to: "/pull-requests", fuzzy: true }),
		onClick: () =>
			navigate({
				to: "/pull-requests",
				search: pullRequestsSearchFromFilters({
					search: filters.search,
					projectFilters: filters.projectFilters,
					authorFilter: filters.authorFilter,
					reviewFilter: filters.reviewFilter,
					includeClosed: filters.includeClosed,
					mergedOnly: filters.mergedOnly,
				}),
			}),
	};
}

function useUsageTarget(): SidebarNavTarget {
	const navigate = useNavigate();
	const { data: usageInSidebar } =
		electronTrpc.settings.getShowUsageInSidebar.useQuery();
	return {
		available: usageInSidebar === true,
		isActive: false,
		// Reopen whichever Usage section was visited last.
		onClick: () => navigate({ to: usageSectionPath(getUsageLastSection()) }),
	};
}

function useWorkspacesTarget(): SidebarNavTarget {
	const matchRoute = useMatchRoute();
	const navigate = useNavigate();
	return {
		available: true,
		isActive: !!matchRoute({ to: "/v2-workspaces" }),
		onClick: () => navigate({ to: "/v2-workspaces" }),
	};
}

function useCloudWorkspacesTarget(): SidebarNavTarget {
	const page = useRoutePage("/cloud-workspaces");
	return { ...page, available: useCloudEnabled() };
}

function useProjectsTarget(): SidebarNavTarget {
	const page = useRoutePage("/projects");
	return { ...page, available: useCloudEnabled() };
}

function usePagesTarget(): SidebarNavTarget {
	return { ...useRoutePage("/pages"), available: true };
}

function useNotesTarget(): SidebarNavTarget {
	return { ...useRoutePage("/notes"), available: true };
}

/** The Desk page, with the count of everything waiting on the user. */
function useDeskTarget(): SidebarNavTarget {
	const { t } = useLingui();
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const items = useDeskQueue();
	const count = items.length;
	const nowCount = items.filter((item) => item.section === "now").length;
	return {
		available: true,
		isActive: !!matchRoute({ to: "/desk", fuzzy: true }),
		onClick: () => navigate({ to: "/desk" }),
		badge:
			count > 0
				? {
						count,
						tone: "attention",
						title: t`Needs you: ${nowCount} now, ${count} in all`,
					}
				: null,
	};
}

function useGitGraphTarget(): SidebarNavTarget {
	return { ...useRoutePage("/git-graph"), available: true };
}

function useInsightsTarget(): SidebarNavTarget {
	return { ...useRoutePage("/insights"), available: true };
}

/** Local automations run by Relais, beside the Pro ones. */
function useMyAutomationsTarget(): SidebarNavTarget {
	return { ...useRoutePage("/relais"), available: true };
}

function useHostsTarget(): SidebarNavTarget {
	return { ...useRoutePage("/hosts"), available: true };
}

function useOfficeTarget(): SidebarNavTarget {
	return { ...useRoutePage("/office"), available: true };
}

function usePluginsTarget(): SidebarNavTarget {
	const page = useRoutePage("/plugins");
	return { ...page, available: usePluginsEnabled() };
}

/**
 * Every page of the sidebar menu but Search, in `SIDEBAR_NAV_ITEMS` order.
 * A page from another feature adds one entry here with its own `useTarget`.
 */
export const SIDEBAR_NAV_ENTRIES: SidebarNavEntry[] = [
	{
		id: "workspaces",
		icon: LuLayers,
		thinStroke: true,
		useTarget: useWorkspacesTarget,
	},
	{
		id: "desk",
		icon: LuInbox,
		thinStroke: true,
		useTarget: useDeskTarget,
	},
	{
		id: "hosts",
		icon: LuServer,
		thinStroke: true,
		useTarget: useHostsTarget,
	},
	{
		id: "cloudWorkspaces",
		icon: LuCloud,
		thinStroke: true,
		useTarget: useCloudWorkspacesTarget,
	},
	{
		id: "projects",
		icon: ProjectGlyph,
		useTarget: useProjectsTarget,
	},
	{
		id: "automations",
		icon: LuClock,
		thinStroke: true,
		useTarget: useAutomationsTarget,
	},
	{
		id: "myAutomations",
		icon: LuWorkflow,
		thinStroke: true,
		useTarget: useMyAutomationsTarget,
	},
	{
		id: "tasks",
		icon: HiOutlineClipboardDocumentList,
		useTarget: useTasksTarget,
	},
	{
		id: "pullRequests",
		icon: GoGitPullRequest,
		useTarget: usePullRequestsTarget,
	},
	{ id: "gitGraph", icon: LuGitGraph, useTarget: useGitGraphTarget },
	{
		id: "insights",
		icon: LuActivity,
		thinStroke: true,
		useTarget: useInsightsTarget,
	},
	{
		id: "office",
		icon: LuBuilding2,
		thinStroke: true,
		useTarget: useOfficeTarget,
	},
	{ id: "usage", icon: LuGauge, thinStroke: true, useTarget: useUsageTarget },
	{
		id: "pages",
		icon: LuFileText,
		thinStroke: true,
		useTarget: usePagesTarget,
	},
	{
		id: "notes",
		icon: LuStickyNote,
		thinStroke: true,
		useTarget: useNotesTarget,
	},
	{
		id: "plugins",
		icon: LuPuzzle,
		thinStroke: true,
		useTarget: usePluginsTarget,
	},
];
