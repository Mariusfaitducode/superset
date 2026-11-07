import type { ConversationState } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";

/**
 * One color language for the office: amber needs you, yellow works, green
 * finished unseen, red failed, grey rests.
 */
export type OfficeTone = "need" | "working" | "done" | "failed" | "idle";

export const TONE_RANK: Record<OfficeTone, number> = {
	need: 0,
	failed: 1,
	done: 2,
	working: 3,
	idle: 4,
};

/**
 * A finished turn already looked at (`seen`) rests: it stays that way until
 * the next prompt, so counting it as "needs you" would keep every agent
 * amber.
 */
export function toneFor(state: ConversationState): OfficeTone {
	switch (state) {
		case "request":
			return "need";
		case "failed":
			return "failed";
		case "unseen":
			return "done";
		case "working":
			return "working";
		default:
			return "idle";
	}
}

/** Something to answer, unblock or look at. */
export function needsYou(tone: OfficeTone): boolean {
	return tone === "need" || tone === "failed" || tone === "done";
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
 * Rooms or desks with someone waiting on you first (a question beats an
 * error beats an unseen result), then the busiest, then by name; empty
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

/** With `onlyNeedsMe`, keeps the ones where someone needs you. */
export function visibleIslands<T extends RankableIsland>(
	islands: readonly T[],
	onlyNeedsMe: boolean,
): T[] {
	if (!onlyNeedsMe) return [...islands];
	return islands.filter((island) => island.tones.some(needsYou));
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
