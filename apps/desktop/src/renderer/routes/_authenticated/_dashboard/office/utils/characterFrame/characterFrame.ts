import type { ConversationState } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import type { Point } from "../officeLayout";

export type Bubble = "approval" | "error" | "done" | "waiting";
export type Pose = "sit" | "type" | "stand" | "walk";
export type Facing = "down" | "up" | "left" | "right";

export interface CharacterFrame extends Point {
	pose: Pose;
	facing: Facing;
	/** Alternates 0/1 for typing hands and walking legs. */
	step: 0 | 1;
	bubble: Bubble | null;
}

const WALK_TILES_PER_SECOND = 2;
const TYPE_STEP_MS = 250;
const WALK_STEP_MS = 200;
const COFFEE_MS = 8_000;
const SIT_MS = 25_000;
const SIT_JITTER_MS = 2_500;

/** A bubble stays until the user acts on the conversation. */
export function bubbleFor(state: ConversationState): Bubble | null {
	switch (state) {
		case "request":
			return "approval";
		case "failed":
			return "error";
		case "unseen":
			return "done";
		case "seen":
			return "waiting";
		default:
			return null;
	}
}

/** Stable per conversation, so idle agents do not all walk in step. */
export function seedFor(id: string): number {
	let hash = 0;
	for (let index = 0; index < id.length; index++) {
		hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
	}
	return hash;
}

function segmentLength(from: Point, to: Point): number {
	return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

export function pathLength(path: Point[]): number {
	let length = 0;
	for (let index = 1; index < path.length; index++) {
		length += segmentLength(path[index - 1] as Point, path[index] as Point);
	}
	return length;
}

/** The point `distance` tiles along a path of straight segments. */
export function pointAlong(
	path: Point[],
	distance: number,
): Point & { facing: Facing } {
	let left = Math.max(0, distance);
	for (let index = 1; index < path.length; index++) {
		const from = path[index - 1] as Point;
		const to = path[index] as Point;
		const length = segmentLength(from, to);
		const facing: Facing =
			to.x > from.x
				? "right"
				: to.x < from.x
					? "left"
					: to.y < from.y
						? "up"
						: "down";
		if (left <= length || index === path.length - 1) {
			const ratio = length === 0 ? 1 : Math.min(left / length, 1);
			return {
				x: from.x + (to.x - from.x) * ratio,
				y: from.y + (to.y - from.y) * ratio,
				facing,
			};
		}
		left -= length;
	}
	const only = path[0] ?? { x: 0, y: 0 };
	return { ...only, facing: "down" };
}

function reverseFacing(facing: Facing): Facing {
	return { up: "down", down: "up", left: "right", right: "left" }[
		facing
	] as Facing;
}

/**
 * An idle agent sits a while, walks to the coffee counter, waits there and
 * walks back, on a loop derived from the clock alone.
 */
function idleFrame(
	path: Point[],
	timeMs: number,
	seed: number,
): CharacterFrame {
	const seat = path[0] ?? { x: 0, y: 0 };
	const sitting: CharacterFrame = {
		...seat,
		pose: "sit",
		facing: "down",
		step: 0,
		bubble: null,
	};
	const length = pathLength(path);
	if (length === 0) return sitting;

	const sitMs = SIT_MS + (seed % 8) * SIT_JITTER_MS;
	const walkMs = (length / WALK_TILES_PER_SECOND) * 1000;
	const cycleMs = sitMs + walkMs + COFFEE_MS + walkMs;
	const phase = (timeMs + (seed % 997) * 61) % cycleMs;
	const step = (Math.floor(phase / WALK_STEP_MS) % 2) as 0 | 1;

	if (phase < sitMs) return sitting;
	if (phase < sitMs + walkMs) {
		const at = pointAlong(path, ((phase - sitMs) / walkMs) * length);
		return { ...at, pose: "walk", step, bubble: null };
	}
	if (phase < sitMs + walkMs + COFFEE_MS) {
		const end = path[path.length - 1] ?? seat;
		return { ...end, pose: "stand", facing: "left", step: 0, bubble: null };
	}
	const walked = ((phase - sitMs - walkMs - COFFEE_MS) / walkMs) * length;
	const at = pointAlong(path, length - walked);
	return {
		...at,
		facing: reverseFacing(at.facing),
		pose: "walk",
		step,
		bubble: null,
	};
}

/**
 * What to draw for one agent at a given time. With reduced motion every
 * agent stays at its desk and nothing alternates; the bubble still shows the
 * state.
 */
export function characterFrame({
	state,
	path,
	timeMs,
	seed,
	reducedMotion,
}: {
	state: ConversationState;
	/** From the seat to the coffee counter; the first point is the seat. */
	path: Point[];
	timeMs: number;
	seed: number;
	reducedMotion: boolean;
}): CharacterFrame {
	const seat = path[0] ?? { x: 0, y: 0 };
	if (state === "working") {
		return {
			...seat,
			pose: "type",
			facing: "down",
			step: reducedMotion
				? 0
				: ((Math.floor(timeMs / TYPE_STEP_MS) % 2) as 0 | 1),
			bubble: null,
		};
	}
	if (state === "idle" && !reducedMotion) return idleFrame(path, timeMs, seed);
	return {
		...seat,
		pose: "sit",
		facing: "down",
		step: 0,
		bubble: bubbleFor(state),
	};
}
