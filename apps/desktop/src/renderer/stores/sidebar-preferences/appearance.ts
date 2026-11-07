import type { AgentState } from "renderer/lib/agent-state";

export type SidebarDensity = "compact" | "normal" | "comfortable";
export type SidebarContrast = "soft" | "normal" | "strong";
/** How the conversation open in a pane stands out in the list. */
export type ActiveMarker = "outline" | "bar" | "fill";
export type MarkerIntensity = "subtle" | "normal" | "strong";
export type BandWidth = 1 | 2 | 3 | 4;
export type StatePalette = "default" | "monochrome" | "colorblind" | "neon";

/** Legend order: the five agent states of `renderer/lib/agent-state`. */
export const STATE_COLOR_KEYS = [
	"needsYou",
	"working",
	"unseen",
	"failed",
	"idle",
] as const satisfies readonly AgentState[];
export type StateColorKey = AgentState;
export type StateColors = Record<StateColorKey, string>;

export const STATE_PALETTES: Record<StatePalette, StateColors> = {
	default: {
		needsYou: "#f59e0b",
		working: "#facc15",
		unseen: "#22c55e",
		failed: "#ef4444",
		idle: "#71717a",
	},
	// Grey except what asks for the user.
	monochrome: {
		needsYou: "#f59e0b",
		working: "#d4d4d8",
		unseen: "#fafafa",
		failed: "#ef4444",
		idle: "#52525b",
	},
	// Okabe-Ito: tells the states apart with every common color blindness.
	colorblind: {
		needsYou: "#e69f00",
		working: "#f0e442",
		unseen: "#009e73",
		failed: "#d55e00",
		idle: "#71717a",
	},
	neon: {
		needsYou: "#ff9f1c",
		working: "#ffe600",
		unseen: "#39ff14",
		failed: "#ff2e63",
		idle: "#6b7280",
	},
};

export function stateColorVar(key: StateColorKey): string {
	return `--sb-state-${key}`;
}

const DENSITY_VARS: Record<SidebarDensity, Record<string, string>> = {
	compact: {
		"--sb-row-h": "24px",
		"--sb-conv-h": "20px",
		"--sb-conv-text": "11px",
	},
	normal: {
		"--sb-row-h": "28px",
		"--sb-conv-h": "24px",
		"--sb-conv-text": "12px",
	},
	comfortable: {
		"--sb-row-h": "32px",
		"--sb-conv-h": "28px",
		"--sb-conv-text": "13px",
	},
};

export const COMPACT_ROW_VARS = DENSITY_VARS.compact;

const MARKER_FILL: Record<MarkerIntensity, string> = {
	subtle: "6%",
	normal: "10%",
	strong: "18%",
};

export interface SidebarAppearance {
	density: SidebarDensity;
	contrast: SidebarContrast;
	activeMarker: ActiveMarker;
	markerIntensity: MarkerIntensity;
	bandWidth: BandWidth;
	statePalette: StatePalette;
	/** Per-state colors picked by hand, over the palette. */
	stateColors: Partial<StateColors>;
	/** Stripe each conversation with its group's or project's color. */
	folderColorOnConversations: boolean;
}

export function resolveStateColors(
	appearance: Pick<SidebarAppearance, "statePalette" | "stateColors">,
): StateColors {
	return {
		...STATE_PALETTES[appearance.statePalette],
		...appearance.stateColors,
	};
}

/** The CSS variables the sidebar and every state dot read. */
export function buildAppearanceVars(
	appearance: SidebarAppearance,
): Record<string, string> {
	const colors = resolveStateColors(appearance);
	const vars: Record<string, string> = {
		...DENSITY_VARS[appearance.density],
		"--sb-band": `${appearance.bandWidth}px`,
		"--sb-marker-fill": MARKER_FILL[appearance.markerIntensity],
	};
	for (const key of STATE_COLOR_KEYS) {
		vars[stateColorVar(key)] = colors[key];
	}
	return vars;
}
