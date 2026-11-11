import { FEATURE_FLAGS } from "@superset/shared/constants";
import { cn } from "@superset/ui/utils";
import {
	createFileRoute,
	Outlet,
	useLocation,
	useNavigate,
} from "@tanstack/react-router";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useEffect, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useIsV2CloudEnabled } from "renderer/hooks/useIsV2CloudEnabled";
import {
	type SettingsSection,
	useSetSettingsSearchQuery,
	useSettingsOriginRoute,
	useSettingsSearchQuery,
} from "renderer/stores/settings-state";
import { ContentBoundary } from "../../components/ContentBoundary";
import { PAGE_WIDTH } from "../components/PageBody";
import { PageHeader } from "../components/PageHeader";
import { SearchResultsBanner } from "./components/SearchResultsBanner";
import { FULL_WIDTH_SECTION_PATHS } from "./components/SettingsNavPanel";
import { SettingsSidebar } from "./components/SettingsSidebar";
import { useScrollReset } from "./hooks/useScrollReset";
import { getVisibleMatchCountBySection } from "./utils/settings-search";

export const Route = createFileRoute("/_authenticated/_dashboard/settings")({
	component: SettingsLayout,
});

const SECTION_ORDER: SettingsSection[] = [
	"account",
	"connections",
	"appearance",
	"ringtones",
	"mobile",
	"keyboard",
	"behavior",
	"git",
	"agents",
	"terminal",
	"files",
	"browser",
	"environments",
	"agentAccounts",
	"organization",
	"teams",
	"project",
	"integrations",
	"billing",
	"apikeys",
	"security",
	"permissions",
	"hosts",
	"experimental",
];

/**
 * Single source of truth for section <-> path, read in both directions by
 * getSectionFromPath/getPathFromSection below instead of two independently
 * hand-maintained lookups that can drift out of sync with each other.
 */
const SECTION_PATHS: Partial<Record<SettingsSection, string>> = {
	mobile: "/settings/mobile",
	account: "/settings/account",
	connections: "/settings/connections",
	organization: "/settings/organization",
	teams: "/settings/teams",
	appearance: "/settings/appearance",
	sidebar: "/settings/sidebar",
	ringtones: "/settings/ringtones",
	keyboard: "/settings/keyboard",
	behavior: "/settings/behavior",
	git: "/settings/git",
	agents: "/settings/agents",
	terminal: "/settings/terminal",
	files: "/settings/files",
	browser: "/settings/browser",
	experimental: "/settings/experimental",
	integrations: "/settings/integrations",
	billing: "/settings/billing",
	apikeys: "/settings/api-keys",
	security: "/settings/security",
	permissions: "/settings/permissions",
	hosts: "/settings/hosts",
	project: "/settings/projects",
};

function getSectionFromPath(pathname: string): SettingsSection | null {
	const match = Object.entries(SECTION_PATHS).find(([, path]) =>
		pathname.includes(path),
	);
	return match ? (match[0] as SettingsSection) : null;
}

function getPathFromSection(section: SettingsSection): string {
	return SECTION_PATHS[section] ?? "/settings/account";
}

function SettingsLayout() {
	const isV2CloudEnabled = useIsV2CloudEnabled();
	const mobileEnabled =
		useFeatureFlagEnabled(FEATURE_FLAGS.MOBILE_LAUNCH) === true;
	const cloudWorkspacesEnabled =
		useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES) === true;
	const searchQuery = useSettingsSearchQuery();
	const setSearchQuery = useSetSettingsSearchQuery();
	const originRoute = useSettingsOriginRoute();
	const location = useLocation();
	const navigate = useNavigate();
	// Reset scroll to top when navigating to a different settings page.
	const contentRef = useScrollReset<HTMLDivElement>(location.pathname);
	const normalizedSearchQuery = searchQuery.trim();
	const isSearchActive = normalizedSearchQuery.length > 0;
	// Variant-filtered like the sidebar's per-section counts, so hidden
	// v1-/v2-only items are never reported as matches.
	const matchCounts = useMemo(
		() =>
			isSearchActive
				? getVisibleMatchCountBySection(
						normalizedSearchQuery,
						isV2CloudEnabled,
						cloudWorkspacesEnabled,
						mobileEnabled,
					)
				: {},
		[
			isSearchActive,
			normalizedSearchQuery,
			isV2CloudEnabled,
			cloudWorkspacesEnabled,
			mobileEnabled,
		],
	);
	const totalMatches = Object.values(matchCounts).reduce(
		(sum, count) => sum + count,
		0,
	);

	useEffect(() => {
		if (!isSearchActive) return;

		const currentSection = getSectionFromPath(location.pathname);
		if (!currentSection) return;

		if (currentSection === "project") return;
		if (currentSection === "hosts") return;

		const currentHasMatches = (matchCounts[currentSection] ?? 0) > 0;

		if (!currentHasMatches) {
			const firstMatch = SECTION_ORDER.find(
				(section) => (matchCounts[section] ?? 0) > 0,
			);
			if (firstMatch) {
				navigate({ to: getPathFromSection(firstMatch), replace: true });
			}
		}
	}, [isSearchActive, location.pathname, navigate, matchCounts]);

	useHotkeys(
		"escape",
		(event) => {
			if (document.querySelector('[data-state="open"]')) return;
			const segments = location.pathname.split("/").filter(Boolean);
			event.preventDefault();
			if (segments.length <= 2) {
				navigate({ to: originRoute });
				return;
			}

			navigate({ to: `/${segments.slice(0, -1).join("/")}` });
		},
		{ enableOnFormTags: false, enableOnContentEditable: false },
		[navigate, location.pathname, originRoute],
	);

	const usesFullWidthContent = FULL_WIDTH_SECTION_PATHS.some((path) =>
		location.pathname.startsWith(path),
	);

	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			{!isV2CloudEnabled && <SettingsSidebar />}
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
				<PageHeader />
				<div ref={contentRef} className="flex-1 overflow-auto">
					{isSearchActive && (
						<SearchResultsBanner
							query={normalizedSearchQuery}
							matchCount={totalMatches}
							onClear={() => setSearchQuery("")}
						/>
					)}
					<ContentBoundary>
						{usesFullWidthContent ? (
							<Outlet />
						) : (
							<div className={cn("mx-auto", PAGE_WIDTH.reading)}>
								<Outlet />
							</div>
						)}
					</ContentBoundary>
				</div>
			</div>
		</div>
	);
}
