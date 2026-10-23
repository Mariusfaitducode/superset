/**
 * Our own pixel art, one string per row, one character per pixel; `.` is
 * transparent. Palette letters: k outline, h hair, s skin, e eyes, c shirt,
 * C shirt shade, p trousers.
 */
export type SpriteRows = readonly string[];

const HEAD_FRONT = [
	"................",
	"....kkkkkkkk....",
	"...khhhhhhhhk...",
	"...khhhhhhhhk...",
	"...khsssssshk...",
	"...kssessessk...",
	"...kssssssssk...",
	"....kssssssk....",
];

const HEAD_BACK = [
	"................",
	"....kkkkkkkk....",
	"...khhhhhhhhk...",
	"...khhhhhhhhk...",
	"...khhhhhhhhk...",
	"...khhhhhhhhk...",
	"...kshhhhhhsk...",
	"....kssssssk....",
];

const SEATED_BODY = [
	"..kccccsscccck..",
	"..kcccccccccck..",
	".kcCccccccccCck.",
	".kcCccccccccCck.",
];

const STANDING_BODY = [
	"....kccsscck....",
	"...kcccccccck...",
	"..kscccccccsk...",
	"...kcccccccck...",
	"...kppppppppk...",
];

export const CHARACTER_SPRITES = {
	sit: [
		...HEAD_FRONT,
		...SEATED_BODY,
		".kssCccccccCssk.",
		"..kkkkkkkkkkkk..",
		"................",
		"................",
	],
	type0: [
		...HEAD_FRONT,
		...SEATED_BODY.slice(0, 3),
		".kssCcccccccCck.",
		".kkkCccccccCssk.",
		"..kkkkkkkkkkkk..",
		"................",
		"................",
	],
	type1: [
		...HEAD_FRONT,
		...SEATED_BODY.slice(0, 3),
		".kcCcccccccCssk.",
		".kssCccccccCkkk.",
		"..kkkkkkkkkkkk..",
		"................",
		"................",
	],
	stand: [
		...HEAD_FRONT,
		...STANDING_BODY,
		"...kppk..kppk...",
		"...kppk..kppk...",
		"...kkkk..kkkk...",
	],
	walkDown0: [
		...HEAD_FRONT,
		...STANDING_BODY,
		"...kppk..kppk...",
		"...kppk..kkkk...",
		"...kkkk.........",
	],
	walkDown1: [
		...HEAD_FRONT,
		...STANDING_BODY,
		"...kppk..kppk...",
		"...kkkk..kppk...",
		".........kkkk...",
	],
	walkUp0: [
		...HEAD_BACK,
		...STANDING_BODY,
		"...kppk..kppk...",
		"...kppk..kkkk...",
		"...kkkk.........",
	],
	walkUp1: [
		...HEAD_BACK,
		...STANDING_BODY,
		"...kppk..kppk...",
		"...kkkk..kppk...",
		".........kkkk...",
	],
} as const satisfies Record<string, SpriteRows>;

export type CharacterSprite = keyof typeof CHARACTER_SPRITES;

export interface CharacterPalette {
	h: string;
	s: string;
	c: string;
	C: string;
	p: string;
}

const OUTLINE = "#1d1a24";
const EYES = "#1d1a24";

const HAIR = ["#3b2a20", "#6b3f1f", "#d9a441", "#1f1f2b", "#a33d2b", "#8d8d99"];
const SKIN = ["#f2c7a5", "#d9a07a", "#a8714f", "#6e4630"];
const SHIRTS: [string, string][] = [
	["#4f7cd6", "#3a5ea8"],
	["#d65f4f", "#a8463a"],
	["#4fa86b", "#3a7d50"],
	["#c98bd6", "#9a68a6"],
	["#e0a03a", "#b07a24"],
	["#4fb8c2", "#3a8b93"],
];
const TROUSERS = ["#2e3550", "#3b3b44", "#4a3a2e"];

/** A look picked from the conversation's seed, so it never changes. */
export function characterPalette(seed: number): CharacterPalette {
	const shirt = SHIRTS[seed % SHIRTS.length] ?? SHIRTS[0];
	return {
		h: HAIR[Math.floor(seed / 7) % HAIR.length] ?? "#3b2a20",
		s: SKIN[Math.floor(seed / 11) % SKIN.length] ?? "#f2c7a5",
		c: shirt?.[0] ?? "#4f7cd6",
		C: shirt?.[1] ?? "#3a5ea8",
		p: TROUSERS[Math.floor(seed / 13) % TROUSERS.length] ?? "#2e3550",
	};
}

export function characterColor(
	palette: CharacterPalette,
	cell: string,
): string | null {
	switch (cell) {
		case ".":
			return null;
		case "k":
			return OUTLINE;
		case "e":
			return EYES;
		default:
			return palette[cell as keyof CharacterPalette] ?? null;
	}
}

export const PLANT: SpriteRows = [
	"................",
	"......gg.g......",
	"....g.gGgg.g....",
	"...gGgGggGgGg...",
	"..gGgggGGgggGg..",
	"...gGgGggGgGg...",
	"..gggGgggGgggg..",
	"...gGggGgggGg...",
	"....ggGgGgGg....",
	".....gggggg.....",
	"....kkkkkkkk....",
	"....krrrrrrk....",
	".....krrrrk.....",
	".....krrrrk.....",
	"......kkkk......",
	"................",
];

export const PLANT_COLORS: Record<string, string> = {
	g: "#4f9a4a",
	G: "#2f6b34",
	r: "#b0623a",
	k: OUTLINE,
};

/** Two tiles wide: a counter with a coffee machine and a mug. */
export const COFFEE_COUNTER: SpriteRows = [
	"................................",
	"....kkkkkkkkkk..................",
	"....kmmmmmmmmk..................",
	"....kmddddddmk..................",
	"....kmdllllldk..................",
	"....kmddddddmk..................",
	"....kmmmmmmmmk..................",
	"....kmmkkkkmmk.........kkk......",
	"....kmmk..kmmk........kwwwk.....",
	"....kmmk..kmmk........kwwwkk....",
	"....kmmkbbkmmk........kwwwk.k...",
	"....kmmmmmmmmk........kwwwkk....",
	"kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
	"kttttttttttttttttttttttttttttttk",
	"kTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTk",
	"kTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTk",
];

export const COFFEE_COLORS: Record<string, string> = {
	k: OUTLINE,
	m: "#8e8e9a",
	d: "#4a4a55",
	l: "#e05a4a",
	b: "#6b3f1f",
	w: "#f4f1ea",
	t: "#b98a5a",
	T: "#946a43",
};

/** Shows the agent is waiting on the user; drawn above its head. */
export const BUBBLE_GLYPHS = {
	approval: ["..k..", "..k..", "..k..", ".....", "..k.."],
	error: ["k...k", ".k.k.", "..k..", ".k.k.", "k...k"],
	done: [".....", "....k", "...k.", "k.k..", ".k..."],
	waiting: [".....", ".....", ".....", "k.k.k", "....."],
} as const satisfies Record<string, SpriteRows>;

/** Digits for the post-it count, 3×5. */
export const DIGITS: Record<string, SpriteRows> = {
	"0": ["kkk", "k.k", "k.k", "k.k", "kkk"],
	"1": [".k.", "kk.", ".k.", ".k.", "kkk"],
	"2": ["kkk", "..k", "kkk", "k..", "kkk"],
	"3": ["kkk", "..k", ".kk", "..k", "kkk"],
	"4": ["k.k", "k.k", "kkk", "..k", "..k"],
	"5": ["kkk", "k..", "kkk", "..k", "kkk"],
	"6": ["kkk", "k..", "kkk", "k.k", "kkk"],
	"7": ["kkk", "..k", ".k.", ".k.", ".k."],
	"8": ["kkk", "k.k", "kkk", "k.k", "kkk"],
	"9": ["kkk", "k.k", "kkk", "..k", "kkk"],
	"+": ["...", ".k.", "kkk", ".k.", "..."],
};
