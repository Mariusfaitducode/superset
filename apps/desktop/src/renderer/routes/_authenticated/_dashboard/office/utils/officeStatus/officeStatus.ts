import { WORK_STATES, type WorkState } from "renderer/lib/agent-state";

/**
 * The office speaks the shared work-state language: waiting on you, working,
 * to resume with its to-dos, parked for later, done and closable.
 */
export type OfficeTone = WorkState;

export const TONE_RANK = Object.fromEntries(
	WORK_STATES.map((state, index) => [state, index]),
) as Record<OfficeTone, number>;

/** The ball is in the user's court. */
export function needsYou(tone: OfficeTone): boolean {
	return tone === "waiting";
}

export interface IslandCounts {
	needYou: number;
	working: number;
}

export function countTones(tones: readonly OfficeTone[]): IslandCounts {
	let needYou = 0;
	let working = 0;
	for (const tone of tones) {
		if (needsYou(tone)) needYou += 1;
		else if (tone === "working") working += 1;
	}
	return { needYou, working };
}

export interface RankableIsland {
	name: string;
	tones: readonly OfficeTone[];
}

function urgency(tones: readonly OfficeTone[]): number[] {
	const counts = [0, 0, 0, 0];
	for (const tone of tones) {
		const rank = TONE_RANK[tone];
		if (rank < counts.length) counts[rank] = (counts[rank] ?? 0) - 1;
	}
	return counts;
}

/** The most urgent tone among a workspace's chats; null with no chat. */
export function deskTone(tones: readonly OfficeTone[]): OfficeTone | null {
	let best: OfficeTone | null = null;
	for (const tone of tones) {
		if (best === null || TONE_RANK[tone] < TONE_RANK[best]) best = tone;
	}
	return best;
}

/**
 * Rooms or desks with someone waiting on you first, then one to check, then
 * the busiest, then the ones with to-dos to pick up, then by name; empty
 * ones last.
 */
export function orderIslands<T extends RankableIsland>(islands: readonly T[]) {
	const keyed = islands.map((island) => ({
		island,
		key: urgency(island.tones),
	}));
	keyed.sort((a, b) => {
		for (let index = 0; index < a.key.length; index++) {
			const diff = (a.key[index] ?? 0) - (b.key[index] ?? 0);
			if (diff !== 0) return diff;
		}
		const empty =
			Number(a.island.tones.length === 0) - Number(b.island.tones.length === 0);
		if (empty !== 0) return empty;
		return a.island.name.localeCompare(b.island.name);
	});
	return keyed.map(({ island }) => island);
}

export type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/**
 * The agent an arrow key moves to: left and right walk the reading order,
 * up and down jump to the nearest agent on the closest row above or below.
 * Stays put at an edge.
 */
export function moveFocus(
	points: readonly { x: number; y: number }[],
	from: number,
	key: ArrowKey,
): number {
	const current = points[from];
	if (!current) return from;
	if (key === "ArrowLeft") return Math.max(0, from - 1);
	if (key === "ArrowRight") return Math.min(points.length - 1, from + 1);
	const down = key === "ArrowDown";
	let best = from;
	let bestRow = Number.POSITIVE_INFINITY;
	let bestColumn = Number.POSITIVE_INFINITY;
	points.forEach((point, index) => {
		const rowGap = down ? point.y - current.y : current.y - point.y;
		if (rowGap <= 0) return;
		const columnGap = Math.abs(point.x - current.x);
		if (rowGap < bestRow || (rowGap === bestRow && columnGap < bestColumn)) {
			best = index;
			bestRow = rowGap;
			bestColumn = columnGap;
		}
	});
	return best;
}
