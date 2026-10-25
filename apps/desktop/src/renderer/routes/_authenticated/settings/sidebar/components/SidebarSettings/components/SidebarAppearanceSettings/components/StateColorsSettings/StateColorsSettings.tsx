import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { LuRotateCcw } from "react-icons/lu";
import { SettingsRow } from "renderer/routes/_authenticated/settings/components/SettingsRow";
import {
	resolveStateColors,
	STATE_COLOR_KEYS,
	STATE_PALETTES,
	type StateColorKey,
	type StatePalette,
	stateColorVar,
	useSidebarPreferencesStore,
} from "renderer/stores/sidebar-preferences";

/** The palette, and a color picker per state that doubles as the legend. */
export function StateColorsSettings() {
	const { t } = useLingui();
	const statePalette = useSidebarPreferencesStore(
		(state) => state.statePalette,
	);
	const stateColors = useSidebarPreferencesStore((state) => state.stateColors);
	const setAppearance = useSidebarPreferencesStore(
		(state) => state.setAppearance,
	);
	const setStateColor = useSidebarPreferencesStore(
		(state) => state.setStateColor,
	);
	const colors = resolveStateColors({ statePalette, stateColors });

	const paletteLabel: Record<StatePalette, string> = {
		default: t`Default`,
		monochrome: t`Monochrome`,
		colorblind: t`Colorblind-safe`,
		neon: t`Neon`,
	};
	const stateLabel: Record<StateColorKey, string> = {
		working: t`Working`,
		request: t`Needs your approval`,
		unseen: t`Finished — not opened yet`,
		seen: t`Waiting for your reply`,
		failed: t`Stopped on an error`,
		idle: t`Idle`,
	};

	return (
		<>
			<SettingsRow
				label={t`State colors`}
				hint={t`Colors of the agent state dots, in the sidebar and the switchers.`}
				htmlFor="sidebar-statePalette"
			>
				<Select
					value={statePalette}
					onValueChange={(value) =>
						setAppearance("statePalette", value as StatePalette)
					}
				>
					<SelectTrigger id="sidebar-statePalette" className="w-[160px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{(Object.keys(STATE_PALETTES) as StatePalette[]).map((palette) => (
							<SelectItem key={palette} value={palette}>
								{paletteLabel[palette]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingsRow>
			<ul className="my-2.5 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-border p-2">
				{STATE_COLOR_KEYS.map((key) => (
					<li key={key} className="flex items-center gap-2 text-xs">
						<label
							className="relative flex size-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-muted"
							title={t`Pick a color`}
						>
							<span
								className="size-2.5 rounded-full"
								style={{ backgroundColor: `var(${stateColorVar(key)})` }}
							/>
							<input
								type="color"
								value={colors[key]}
								onChange={(event) => setStateColor(key, event.target.value)}
								aria-label={t`Color for ${stateLabel[key]}`}
								className="absolute inset-0 cursor-pointer opacity-0"
							/>
						</label>
						<span className="min-w-0 flex-1 truncate">{stateLabel[key]}</span>
						{stateColors[key] ? (
							<Button
								variant="ghost"
								size="icon"
								className="size-5"
								onClick={() => setStateColor(key, null)}
								aria-label={t`Use the palette's color`}
								title={t`Use the palette's color`}
							>
								<LuRotateCcw className="size-3" />
							</Button>
						) : null}
					</li>
				))}
			</ul>
			{Object.keys(stateColors).length > 0 ? (
				<p className="text-xs text-muted-foreground">
					<Trans>Hand-picked colors stay when you change the palette.</Trans>
				</p>
			) : null}
		</>
	);
}
