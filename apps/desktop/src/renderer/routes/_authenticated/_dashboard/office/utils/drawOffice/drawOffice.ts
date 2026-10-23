import type { ConversationState } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import type { LabelColor } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/WorkspaceLabels/labels";
import {
	type Bubble,
	type CharacterFrame,
	characterFrame,
} from "../characterFrame";
import {
	DEVICES_PER_RACK,
	type OfficeIsland,
	type OfficeLayout,
	type OfficeSeat,
	type Point,
	TILE_SIZE,
	WALL_HEIGHT,
} from "../officeLayout";
import {
	BUBBLE_GLYPHS,
	CHARACTER_SPRITES,
	type CharacterSprite,
	COFFEE_COLORS,
	COFFEE_COUNTER,
	characterColor,
	characterPalette,
	DIGITS,
	PLANT,
	PLANT_COLORS,
	type SpriteRows,
} from "../sprites";

export interface OfficeSceneAgent {
	terminalId: string;
	state: ConversationState;
	openTodos: number;
	seed: number;
	seat: OfficeSeat;
	/** From the seat to the coffee counter. */
	path: Point[];
}

export interface OfficeScene {
	layout: OfficeLayout;
	islands: { island: OfficeIsland; color: LabelColor | null }[];
	agents: OfficeSceneAgent[];
	devices: number;
}

const T = TILE_SIZE;
const OUTLINE = "#1d1a24";

const RUG_COLORS: Record<LabelColor, string> = {
	gray: "#6b6b78",
	red: "#9c4a45",
	orange: "#ad6a38",
	amber: "#a8873a",
	green: "#4a8055",
	teal: "#3a7f7b",
	blue: "#46629c",
	violet: "#70549c",
	pink: "#9c5482",
};
const DEFAULT_RUG = "#5d6275";

const BUBBLE_COLORS: Record<Bubble, string> = {
	approval: "#7c3aed",
	error: "#dc2626",
	done: "#16a34a",
	waiting: "#2563eb",
};

function paint(
	ctx: CanvasRenderingContext2D,
	rows: SpriteRows,
	colorOf: (cell: string) => string | null | undefined,
	x: number,
	y: number,
	flip = false,
) {
	rows.forEach((row, rowIndex) => {
		for (let column = 0; column < row.length; column++) {
			const color = colorOf(row[column] as string);
			if (!color) continue;
			const px = flip ? row.length - 1 - column : column;
			ctx.fillStyle = color;
			ctx.fillRect(x + px, y + rowIndex, 1, 1);
		}
	});
}

function drawFloor(ctx: CanvasRenderingContext2D, layout: OfficeLayout) {
	for (let ty = WALL_HEIGHT; ty < layout.height; ty++) {
		for (let tx = 0; tx < layout.width; tx++) {
			const x = tx * T;
			const y = ty * T;
			ctx.fillStyle = ty % 2 === 0 ? "#b07a4a" : "#a8723f";
			ctx.fillRect(x, y, T, T);
			ctx.fillStyle = "#8e5f35";
			ctx.fillRect(x, y + T - 1, T, 1);
			ctx.fillRect(x + ((tx + ty) % 2 === 0 ? 0 : 8), y, 1, T - 1);
		}
	}
}

function drawWall(ctx: CanvasRenderingContext2D, layout: OfficeLayout) {
	const width = layout.width * T;
	ctx.fillStyle = "#4a4560";
	ctx.fillRect(0, 0, width, WALL_HEIGHT * T);
	ctx.fillStyle = "#2d2a3a";
	ctx.fillRect(0, 0, width, 4);
	ctx.fillRect(0, WALL_HEIGHT * T - 3, width, 3);
	const lastWindow = layout.width - 3 * layout.racks.length - 4;
	for (let tx = 5; tx <= lastWindow; tx += 6) {
		const x = tx * T;
		ctx.fillStyle = "#2d2a3a";
		ctx.fillRect(x - 1, 9, 3 * T + 2, T + 14);
		ctx.fillStyle = "#8fc3e8";
		ctx.fillRect(x, 10, 3 * T, T + 12);
		ctx.fillStyle = "#b8dcf2";
		ctx.fillRect(x + 3, 13, 6, 4);
		ctx.fillStyle = "#2d2a3a";
		ctx.fillRect(x + (3 * T) / 2, 10, 1, T + 12);
	}
}

function drawRug(
	ctx: CanvasRenderingContext2D,
	island: OfficeIsland,
	color: LabelColor | null,
) {
	const x = island.x * T + 2;
	const y = island.y * T + 2;
	const width = island.width * T - 4;
	const height = island.height * T - 4;
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
	ctx.fillStyle = color ? RUG_COLORS[color] : DEFAULT_RUG;
	ctx.fillRect(x, y, width, height);
	ctx.fillStyle = "rgba(255,255,255,0.12)";
	ctx.fillRect(x + 3, y + 3, width - 6, 1);
	ctx.fillRect(x + 3, y + height - 4, width - 6, 1);
}

function drawNumber(
	ctx: CanvasRenderingContext2D,
	value: number,
	x: number,
	y: number,
) {
	const text = value > 9 ? "9+" : String(value);
	const glyphs = [...text].map((char) => DIGITS[char]).filter(Boolean);
	const width = glyphs.length * 4 - 1;
	glyphs.forEach((glyph, index) => {
		paint(
			ctx,
			glyph as SpriteRows,
			(cell) => (cell === "k" ? OUTLINE : null),
			x - Math.floor(width / 2) + index * 4,
			y,
		);
	});
}

function drawDesk(
	ctx: CanvasRenderingContext2D,
	seat: OfficeSeat,
	agent: OfficeSceneAgent | undefined,
	timeMs: number,
	reducedMotion: boolean,
) {
	const x = seat.desk.x * T;
	const y = seat.desk.y * T;
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x, y, 2 * T, T - 1);
	ctx.fillStyle = "#d9a46c";
	ctx.fillRect(x + 1, y + 1, 2 * T - 2, 1);
	ctx.fillStyle = "#c08a55";
	ctx.fillRect(x + 1, y + 2, 2 * T - 2, 7);
	ctx.fillStyle = "#8a5a33";
	ctx.fillRect(x + 1, y + 9, 2 * T - 2, 5);

	// Keyboard, in front of the agent's hands.
	ctx.fillStyle = "#e4e4ea";
	ctx.fillRect(x + 11, y + 3, 10, 3);
	ctx.fillStyle = "#9a9aa6";
	ctx.fillRect(x + 11, y + 6, 10, 1);

	// Monitor seen from behind, to the agent's left so its face shows.
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x + 22, y - 7, 9, 10);
	ctx.fillStyle = "#3a3a46";
	ctx.fillRect(x + 23, y - 6, 7, 6);
	ctx.fillStyle = "#55556a";
	ctx.fillRect(x + 25, y, 3, 3);
	const working = agent?.state === "working";
	const blink = reducedMotion || Math.floor(timeMs / 500) % 2 === 0;
	ctx.fillStyle = working ? (blink ? "#4ade80" : "#166534") : "#6b6b78";
	ctx.fillRect(x + 28, y - 2, 1, 1);
	if (working) {
		ctx.fillStyle = "rgba(143,195,232,0.35)";
		ctx.fillRect(x + 20, y - 6, 2, 6);
	}

	if (agent && agent.openTodos > 0) {
		ctx.fillStyle = OUTLINE;
		ctx.fillRect(x + 2, y + 1, 9, 9);
		ctx.fillStyle = "#f7d84a";
		ctx.fillRect(x + 3, y + 2, 7, 7);
		ctx.fillStyle = "#e0bd2a";
		ctx.fillRect(x + 3, y + 2, 7, 1);
		drawNumber(ctx, agent.openTodos, x + 6, y + 3);
	}
}

function drawRack(
	ctx: CanvasRenderingContext2D,
	rack: Point,
	firstDevice: number,
	devices: number,
	timeMs: number,
	reducedMotion: boolean,
) {
	const x = rack.x * T;
	const y = rack.y * T - 6;
	const height = 2 * T + 4;
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x + 2, y, 2 * T - 4, height);
	ctx.fillStyle = "#2f2f3a";
	ctx.fillRect(x + 3, y + 1, 2 * T - 6, height - 2);
	for (let slot = 0; slot < DEVICES_PER_RACK; slot++) {
		const sy = y + 3 + slot * 8;
		const connected = firstDevice + slot < devices;
		ctx.fillStyle = connected ? "#4a4a5a" : "#24242d";
		ctx.fillRect(x + 5, sy, 2 * T - 10, 6);
		if (!connected) continue;
		const on =
			reducedMotion ||
			Math.floor(timeMs / 400 + slot * 3 + firstDevice) % 4 !== 0;
		ctx.fillStyle = on ? "#4ade80" : "#166534";
		ctx.fillRect(x + 7, sy + 2, 2, 2);
		ctx.fillStyle = "#60a5fa";
		ctx.fillRect(x + 11, sy + 2, 2, 2);
		ctx.fillStyle = "#1d1a24";
		ctx.fillRect(x + 16, sy + 2, 8, 1);
		ctx.fillRect(x + 16, sy + 4, 8, 1);
	}
}

function spriteFor(frame: CharacterFrame): {
	sprite: CharacterSprite;
	flip: boolean;
} {
	switch (frame.pose) {
		case "type":
			return { sprite: frame.step ? "type1" : "type0", flip: false };
		case "sit":
			return { sprite: "sit", flip: false };
		case "stand":
			return { sprite: "stand", flip: false };
		case "walk":
			if (frame.facing === "up") {
				return { sprite: frame.step ? "walkUp1" : "walkUp0", flip: false };
			}
			return {
				sprite: frame.step ? "walkDown1" : "walkDown0",
				flip: frame.facing === "left",
			};
	}
}

function drawCharacter(
	ctx: CanvasRenderingContext2D,
	frame: CharacterFrame,
	seed: number,
) {
	const palette = characterPalette(seed);
	const { sprite, flip } = spriteFor(frame);
	paint(
		ctx,
		CHARACTER_SPRITES[sprite],
		(cell) => characterColor(palette, cell),
		Math.round(frame.x * T),
		Math.round(frame.y * T),
		flip,
	);
}

function drawBubble(ctx: CanvasRenderingContext2D, frame: CharacterFrame) {
	if (!frame.bubble) return;
	const x = Math.round(frame.x * T) + 9;
	const y = Math.round(frame.y * T) - 9;
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x, y, 11, 10);
	ctx.fillRect(x + 2, y + 10, 2, 2);
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(x + 1, y + 1, 9, 8);
	ctx.fillRect(x + 2, y + 9, 1, 1);
	const color = BUBBLE_COLORS[frame.bubble];
	paint(
		ctx,
		BUBBLE_GLYPHS[frame.bubble],
		(cell) => (cell === "k" ? color : null),
		x + 3,
		y + 2,
	);
}

/** Draws the whole office in art pixels; the caller scales the context. */
export function drawOffice(
	ctx: CanvasRenderingContext2D,
	scene: OfficeScene,
	timeMs: number,
	reducedMotion: boolean,
) {
	const { layout } = scene;
	ctx.clearRect(0, 0, layout.width * T, layout.height * T);
	drawFloor(ctx, layout);
	drawWall(ctx, layout);
	for (const { island, color } of scene.islands) drawRug(ctx, island, color);

	paint(
		ctx,
		COFFEE_COUNTER,
		(cell) => COFFEE_COLORS[cell],
		layout.coffee.x * T,
		layout.coffee.y * T + 6,
	);
	layout.racks.forEach((rack, index) => {
		drawRack(
			ctx,
			rack,
			index * DEVICES_PER_RACK,
			scene.devices,
			timeMs,
			reducedMotion,
		);
	});

	const frames = scene.agents.map((agent) => ({
		agent,
		frame: characterFrame({
			state: agent.state,
			path: agent.path,
			timeMs,
			seed: agent.seed,
			reducedMotion,
		}),
	}));
	const atDesk = (frame: CharacterFrame) =>
		frame.pose === "sit" || frame.pose === "type";

	for (const { agent, frame } of frames) {
		if (atDesk(frame)) drawCharacter(ctx, frame, agent.seed);
	}
	const agentBySeat = new Map(scene.agents.map((agent) => [agent.seat, agent]));
	for (const { island } of scene.islands) {
		for (const seat of island.seats) {
			drawDesk(ctx, seat, agentBySeat.get(seat), timeMs, reducedMotion);
		}
	}
	const walking = frames
		.filter(({ frame }) => !atDesk(frame))
		.sort((a, b) => a.frame.y - b.frame.y);
	for (const { agent, frame } of walking) {
		drawCharacter(ctx, frame, agent.seed);
	}
	for (const plant of layout.plants) {
		paint(ctx, PLANT, (cell) => PLANT_COLORS[cell], plant.x * T, plant.y * T);
	}
	for (const { frame } of frames) drawBubble(ctx, frame);
}
