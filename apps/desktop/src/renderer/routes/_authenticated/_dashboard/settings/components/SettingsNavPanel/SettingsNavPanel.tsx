import { Trans, useLingui } from "@lingui/react/macro";
import { COMPANY, FEATURE_FLAGS } from "@superset/shared/constants";
import { Link } from "@tanstack/react-router";
import { useFeatureFlagEnabled } from "posthog-js/react";
import {
	HiArrowLeft,
	HiArrowTopRightOnSquare,
	HiMagnifyingGlass,
	HiXMark,
} from "react-icons/hi2";
import { useIsV2CloudEnabled } from "renderer/hooks/useIsV2CloudEnabled";
import {
	useSetSettingsSearchQuery,
	useSettingsOriginRoute,
	useSettingsSearchQuery,
} from "renderer/stores/settings-state";
import { getVisibleMatchCountBySection } from "../../utils/settings-search";
import { ForkBuildInfo } from "./components/ForkBuildInfo";
import { GeneralSettings } from "./GeneralSettings";

/** The Settings navigation: back link, search, and the list of sections. */
export function SettingsNavPanel() {
	const { t } = useLingui();
	const searchQuery = useSettingsSearchQuery();
	const setSearchQuery = useSetSettingsSearchQuery();
	const originRoute = useSettingsOriginRoute();
	const isV2CloudEnabled = useIsV2CloudEnabled();
	const mobileEnabled =
		useFeatureFlagEnabled(FEATURE_FLAGS.MOBILE_LAUNCH) === true;
	const cloudWorkspacesEnabled =
		useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES) === true;
	const normalizedSearchQuery = searchQuery.trim();
	const matchCounts = normalizedSearchQuery
		? getVisibleMatchCountBySection(
				normalizedSearchQuery,
				isV2CloudEnabled,
				cloudWorkspacesEnabled,
				mobileEnabled,
			)
		: null;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<Link
				to={originRoute}
				className="mx-2 mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground"
			>
				<HiArrowLeft className="size-4 shrink-0" />
				<span className="truncate">
					<Trans>Settings</Trans>
				</span>
			</Link>

			<div className="relative mx-2 mb-3">
				<HiMagnifyingGlass className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					placeholder={t({
						message: "Search settings...",
					})}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="h-8 w-full rounded-md border-0 bg-accent/50 pr-8 pl-8 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
				/>
				{searchQuery && (
					<button
						type="button"
						aria-label={t({ message: "Clear search" })}
						onClick={() => setSearchQuery("")}
						className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
					>
						<HiXMark className="size-4" />
					</button>
				)}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 hide-scrollbar">
				<GeneralSettings matchCounts={matchCounts} />
				<div className="mt-4 border-t border-border pt-3">
					<a
						href={COMPANY.DOCS_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground"
					>
						<HiArrowTopRightOnSquare className="size-4" />
						<span>
							<Trans>Documentation</Trans>
						</span>
					</a>
					<ForkBuildInfo />
				</div>
			</div>
		</div>
	);
}
