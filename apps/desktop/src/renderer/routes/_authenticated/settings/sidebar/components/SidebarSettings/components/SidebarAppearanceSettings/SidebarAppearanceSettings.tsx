import { useLingui } from "@lingui/react/macro";
import { Switch } from "@superset/ui/switch";
import { SettingsRow } from "renderer/routes/_authenticated/settings/components/SettingsRow";
import {
	type ActiveMarker,
	type BandWidth,
	type MarkerIntensity,
	type SidebarContrast,
	type SidebarDensity,
	useSidebarPreferencesStore,
} from "renderer/stores/sidebar-preferences";
import { Segmented } from "./components/Segmented";
import { SidebarPreview } from "./components/SidebarPreview";
import { StateColorsSettings } from "./components/StateColorsSettings";

interface SidebarAppearanceSettingsProps {
	showLayout: boolean;
	showColors: boolean;
}

/** How the sidebar looks, next to a preview that follows every change. */
export function SidebarAppearanceSettings({
	showLayout,
	showColors,
}: SidebarAppearanceSettingsProps) {
	const { t } = useLingui();
	const preferences = useSidebarPreferencesStore();

	return (
		<div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
			<div className="min-w-0 flex-1 divide-y divide-border">
				{showLayout && (
					<>
						<SettingsRow
							label={t`Density`}
							hint={t`Height of the rows and size of the conversation titles.`}
						>
							<Segmented<SidebarDensity>
								value={preferences.density}
								onChange={(value) =>
									preferences.setAppearance("density", value)
								}
								options={[
									{ value: "compact", label: t`Compact` },
									{ value: "normal", label: t`Normal` },
									{ value: "comfortable", label: t`Airy` },
								]}
							/>
						</SettingsRow>
						<SettingsRow
							label={t`Contrast`}
							hint={t`How much secondary text and separators stand out.`}
						>
							<Segmented<SidebarContrast>
								value={preferences.contrast}
								onChange={(value) =>
									preferences.setAppearance("contrast", value)
								}
								options={[
									{ value: "soft", label: t`Soft` },
									{ value: "normal", label: t`Normal` },
									{ value: "strong", label: t`Strong` },
								]}
							/>
						</SettingsRow>
						<SettingsRow
							label={t`Open conversation`}
							hint={t`How the conversation shown in a pane stands out.`}
						>
							<Segmented<ActiveMarker>
								value={preferences.activeMarker}
								onChange={(value) =>
									preferences.setAppearance("activeMarker", value)
								}
								options={[
									{ value: "outline", label: t`Outline` },
									{ value: "bar", label: t`Side bar` },
									{ value: "fill", label: t`Fill` },
								]}
							/>
						</SettingsRow>
						<SettingsRow
							label={t`Highlight intensity`}
							hint={t`Background of the open conversation.`}
						>
							<Segmented<MarkerIntensity>
								value={preferences.markerIntensity}
								onChange={(value) =>
									preferences.setAppearance("markerIntensity", value)
								}
								options={[
									{ value: "subtle", label: t`Subtle` },
									{ value: "normal", label: t`Normal` },
									{ value: "strong", label: t`Strong` },
								]}
							/>
						</SettingsRow>
						<SettingsRow
							label={t`Stripe width`}
							hint={t`Width of the colored stripes: groups, side bar and folder colors.`}
						>
							<Segmented<`${BandWidth}`>
								value={`${preferences.bandWidth}`}
								onChange={(value) =>
									preferences.setAppearance(
										"bandWidth",
										Number(value) as BandWidth,
									)
								}
								options={[
									{ value: "1", label: "1 px" },
									{ value: "2", label: "2 px" },
									{ value: "3", label: "3 px" },
									{ value: "4", label: "4 px" },
								]}
							/>
						</SettingsRow>
						<SettingsRow
							label={t`Folder color on conversations`}
							hint={t`Stripe each conversation with its group's color, or its project's.`}
							htmlFor="sidebar-folderColorOnConversations"
						>
							<Switch
								id="sidebar-folderColorOnConversations"
								checked={preferences.folderColorOnConversations}
								onCheckedChange={(checked) =>
									preferences.setAppearance(
										"folderColorOnConversations",
										checked,
									)
								}
							/>
						</SettingsRow>
					</>
				)}
				{showColors && (
					<div>
						<StateColorsSettings />
					</div>
				)}
			</div>
			<div className="shrink-0 lg:sticky lg:top-6">
				<SidebarPreview />
			</div>
		</div>
	);
}
