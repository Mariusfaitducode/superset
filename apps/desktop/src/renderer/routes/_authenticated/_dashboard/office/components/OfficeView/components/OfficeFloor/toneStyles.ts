import type { OfficeTone } from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";

/** The small square that names a state, shared by bubbles and plates. */
export const TONE_GLYPH: Record<OfficeTone, string> = {
	need: "!",
	failed: "×",
	done: "✓",
	working: "…",
	idle: "z",
};

export const TONE_GLYPH_CLASS: Record<OfficeTone, string> = {
	need: "bg-[#1d1a24] text-amber-300",
	failed: "bg-[#1d1a24] text-red-300",
	done: "bg-[#1d1a24] text-green-300",
	working: "bg-yellow-400 text-[#1d1a24]",
	idle: "bg-zinc-400 text-[#1d1a24]",
};

/** Plate edge, so a desk's state reads from across the room. */
export const TONE_EDGE_CLASS: Record<OfficeTone, string> = {
	need: "border-l-amber-400",
	failed: "border-l-red-500",
	done: "border-l-green-500",
	working: "border-l-yellow-300",
	idle: "border-l-zinc-400",
};
