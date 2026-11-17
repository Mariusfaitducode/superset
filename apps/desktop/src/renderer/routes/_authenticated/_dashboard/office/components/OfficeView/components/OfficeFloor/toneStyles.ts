import type { OfficeTone } from "renderer/routes/_authenticated/_dashboard/office/utils/officeStatus";

/** The small square that names a state, shared by bubbles and plates. */
export const TONE_GLYPH: Record<OfficeTone, string> = {
	waiting: "!",
	check: "?",
	working: "…",
	todos: "≡",
	resume: "z",
	done: "✓",
};

/** An error waits on you like a question, in red and with its own mark. */
export const ERROR_GLYPH = "×";

export const TONE_GLYPH_CLASS: Record<OfficeTone, string> = {
	waiting: "bg-[#1d1a24] text-amber-300",
	check: "bg-[#1d1a24] text-violet-300",
	working: "bg-yellow-400 text-[#1d1a24]",
	todos: "bg-[#1d1a24] text-sky-300",
	resume: "bg-zinc-400 text-[#1d1a24]",
	done: "bg-[#1d1a24] text-green-300",
};

export const ERROR_GLYPH_CLASS = "bg-[#1d1a24] text-red-300";

/** Plate edge, so a desk's state reads from across the room. */
export const TONE_EDGE_CLASS: Record<OfficeTone, string> = {
	waiting: "border-l-amber-400",
	check: "border-l-violet-400",
	working: "border-l-yellow-300",
	todos: "border-l-sky-400",
	resume: "border-l-zinc-400",
	done: "border-l-green-500",
};
