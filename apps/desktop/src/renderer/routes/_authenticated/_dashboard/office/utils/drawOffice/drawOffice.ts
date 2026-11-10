import type { ConversationState } from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/DashboardSidebarWorkspaceItem/components/DashboardSidebarExpandedWorkspaceRow/components/DashboardSidebarConversationList/utils/conversation-state";
import { type CharacterFrame, characterFrame } from "../characterFrame";
import {
	DEVICES_PER_RACK,
	HEADER_HEIGHT,
	HELPER_SCALE,
	type OfficeDesk,
	type OfficeLayout,
	type OfficeRoom,
	type OfficeSeat,
	type OfficeWorkflow,
	type Point,
	TILE_SIZE,
	WALL_HEIGHT,
	WORKFLOW_SCALE,
} from "../officeLayout";
import {
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

/** A live subagent, working in the strip under its parent's desk. */
export interface OfficeSceneHelper {
	id: string;
	seed: number;
	at: Point;
	/** The parent's desk, for the line that ties them. */
	parentDesk: Point;
}

/** A workflow run's table and the seeds of the agents behind it. */
export interface OfficeSceneWorkflow {
	workflow: OfficeWorkflow;
	seeds: number[];
}

export interface OfficeScene {
	layout: OfficeLayout;
	/** `color` is the group's `#rrggbb`, or null for the default rug. */
	rooms: { room: OfficeRoom; color: string | null }[];
	/** Workspaces without a live chat, drawn dimmed. */
	emptyDesks: ReadonlySet<string>;
	agents: OfficeSceneAgent[];
	helpers: OfficeSceneHelper[];
	/** Subagents past what a strip shows, per seat. */
	extraHelpers: { at: Point; count: number }[];
	workflows: OfficeSceneWorkflow[];
	devices: number;
}

const T = TILE_SIZE;
const OUTLINE = "#1d1a24";

const DEFAULT_RUG = "#5d6275";

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

function drawRoom(
	ctx: CanvasRenderingContext2D,
	room: OfficeRoom,
	color: string | null,
) {
	const x = room.x * T + 2;
	const y = room.y * T + 2;
	const width = room.width * T - 4;
	const height = room.height * T - 4;
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
	ctx.fillStyle = DEFAULT_RUG;
	ctx.fillRect(x, y, width, height);
	if (color) {
		// Muted so the floor keeps its pixel-art palette.
		ctx.globalAlpha = 0.6;
		ctx.fillStyle = color;
		ctx.fillRect(x, y, width, height);
		ctx.globalAlpha = 1;
	}
	// The header strip, a shade darker, carries the room's name.
	ctx.fillStyle = "rgba(0,0,0,0.22)";
	ctx.fillRect(x, y, width, HEADER_HEIGHT * T - 3);
	ctx.fillStyle = "rgba(255,255,255,0.12)";
	ctx.fillRect(x + 3, y + 3, width - 6, 1);
	ctx.fillRect(x + 3, y + height - 4, width - 6, 1);
}

const CARPET = "#d8ccb4";
const CARPET_SHADE = "#cbbfa6";
const PARTITION = "#8d879c";
const PARTITION_TOP = "#b3adc0";

/** A workspace's cubicle: light carpet inside low partition walls. */
function drawCubicle(ctx: CanvasRenderingContext2D, desk: OfficeDesk) {
	const x = desk.x * T;
	const y = desk.y * T + 2;
	const width = desk.width * T;
	const height = desk.height * T - 4;
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x, y, width, height);
	ctx.fillStyle = CARPET;
	ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
	ctx.fillStyle = CARPET_SHADE;
	for (let row = y + 4; row < y + height - 2; row += 4) {
		ctx.fillRect(x + 1, row, width - 2, 1);
	}
	// Partitions on the sides and along the front.
	ctx.fillStyle = PARTITION;
	ctx.fillRect(x + 1, y + 1, 3, height - 2);
	ctx.fillRect(x + width - 4, y + 1, 3, height - 2);
	ctx.fillRect(x + 1, y + height - 5, width - 2, 4);
	ctx.fillStyle = PARTITION_TOP;
	ctx.fillRect(x + 1, y + 1, 1, height - 2);
	ctx.fillRect(x + width - 4, y + 1, 1, height - 2);
	ctx.fillRect(x + 1, y + height - 5, width - 2, 1);
}

/** One shared tabletop under each row of seats, sized to the chats. */
function drawTables(ctx: CanvasRenderingContext2D, desk: OfficeDesk) {
	const rows = new Map<number, { min: number; max: number }>();
	for (const seat of desk.seats) {
		const row = rows.get(seat.desk.y);
		if (row) {
			row.min = Math.min(row.min, seat.desk.x);
			row.max = Math.max(row.max, seat.desk.x);
		} else {
			rows.set(seat.desk.y, { min: seat.desk.x, max: seat.desk.x });
		}
	}
	for (const [deskY, { min, max }] of rows) {
		const x = min * T;
		const y = deskY * T;
		const width = (max - min + 2) * T;
		ctx.fillStyle = OUTLINE;
		ctx.fillRect(x, y, width, T - 1);
		ctx.fillStyle = "#d9a46c";
		ctx.fillRect(x + 1, y + 1, width - 2, 1);
		ctx.fillStyle = "#c08a55";
		ctx.fillRect(x + 1, y + 2, width - 2, 7);
		ctx.fillStyle = "#8a5a33";
		ctx.fillRect(x + 1, y + 9, width - 2, 5);
	}
}

function dimDesk(ctx: CanvasRenderingContext2D, desk: OfficeDesk) {
	ctx.fillStyle = "rgba(29,26,36,0.35)";
	ctx.fillRect(
		desk.x * T + 1,
		desk.y * T + 3,
		desk.width * T - 2,
		desk.height * T - 6,
	);
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

/** One seat's keyboard, monitor and to-do post-it, on the shared table. */
function drawWorkstation(
	ctx: CanvasRenderingContext2D,
	seat: OfficeSeat,
	agent: OfficeSceneAgent | undefined,
	timeMs: number,
	reducedMotion: boolean,
) {
	const x = seat.desk.x * T;
	const y = seat.desk.y * T;

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

/** A small typing character with its laptop: a subagent or a workflow agent. */
function drawSmallWorker(
	ctx: CanvasRenderingContext2D,
	at: Point,
	seed: number,
	scale: number,
	timeMs: number,
	reducedMotion: boolean,
) {
	const step =
		reducedMotion || Math.floor((timeMs + (seed % 7) * 90) / 250) % 2 === 0;
	const palette = characterPalette(seed);
	const x = Math.round(at.x * T);
	const y = Math.round(at.y * T);
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	paint(
		ctx,
		CHARACTER_SPRITES[step ? "type0" : "type1"],
		(cell) => characterColor(palette, cell),
		0,
		0,
	);
	// Laptop on the knees, its screen lit while it works.
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(3, 11, 10, 4);
	ctx.fillStyle = "#c9c9d4";
	ctx.fillRect(4, 12, 8, 2);
	ctx.fillStyle = step ? "#8fc3e8" : "#6fa3c8";
	ctx.fillRect(5, 12, 6, 1);
	ctx.restore();
}

/** A thin cable from a parent's desk to the strip where its subagents work. */
function drawHelperLinks(
	ctx: CanvasRenderingContext2D,
	helpers: readonly OfficeSceneHelper[],
) {
	const byParent = new Map<string, OfficeSceneHelper[]>();
	for (const helper of helpers) {
		const key = `${helper.parentDesk.x},${helper.parentDesk.y}`;
		byParent.set(key, [...(byParent.get(key) ?? []), helper]);
	}
	ctx.fillStyle = "rgba(29,26,36,0.55)";
	for (const group of byParent.values()) {
		const first = group[0];
		if (!first) continue;
		const fromX = Math.round((first.parentDesk.x + 1) * T);
		const fromY = Math.round((first.parentDesk.y + 1) * T) - 2;
		const stripY = Math.round(first.at.y * T) + 1;
		for (let y = fromY; y < stripY; y += 2) ctx.fillRect(fromX, y, 1, 1);
		const left = Math.round(first.at.x * T) + 4;
		const right = Math.round((group.at(-1)?.at.x ?? first.at.x) * T) + 6;
		for (let x = Math.min(left, fromX); x <= Math.max(right, fromX); x += 2) {
			ctx.fillRect(x, stripY, 1, 1);
		}
	}
}

/** A meeting table with the run's agents working behind it. */
function drawWorkflow(
	ctx: CanvasRenderingContext2D,
	{ workflow, seeds }: OfficeSceneWorkflow,
	timeMs: number,
	reducedMotion: boolean,
) {
	const x = workflow.x * T;
	const y = workflow.y * T;
	const width = workflow.width * T;
	// A rug under the meeting area, so the run reads as one group.
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x, y + 2, width, 3 * T - 4);
	ctx.fillStyle = "#c7bba4";
	ctx.fillRect(x + 1, y + 3, width - 2, 3 * T - 6);
	ctx.fillStyle = "rgba(0,0,0,0.12)";
	ctx.fillRect(x + 1, y + 3, width - 2, T - 3);
	workflow.agents.forEach((agent, index) => {
		drawSmallWorker(
			ctx,
			agent,
			seeds[index] ?? index,
			WORKFLOW_SCALE,
			timeMs,
			reducedMotion,
		);
	});
	const tx = workflow.table.x * T;
	const ty = workflow.table.y * T;
	const tw = workflow.table.width * T;
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(tx, ty, tw, 12);
	ctx.fillStyle = "#d9a46c";
	ctx.fillRect(tx + 1, ty + 1, tw - 2, 2);
	ctx.fillStyle = "#b07a45";
	ctx.fillRect(tx + 1, ty + 3, tw - 2, 6);
	ctx.fillStyle = "#7a4e2b";
	ctx.fillRect(tx + 1, ty + 9, tw - 2, 2);
	if (workflow.extraAgents > 0) {
		drawPlus(ctx, workflow.extraAgents, tx + tw - 8, ty + 3);
	}
}

/** "+n" on a light tag, for what does not fit. */
function drawPlus(
	ctx: CanvasRenderingContext2D,
	count: number,
	x: number,
	y: number,
) {
	const text = `+${count > 9 ? 9 : count}`;
	const width = text.length * 4 + 1;
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 7);
	ctx.fillStyle = "#f4f1ea";
	ctx.fillRect(x - width / 2, y, width, 5);
	[...text].forEach((char, index) => {
		const glyph = DIGITS[char];
		if (!glyph) return;
		paint(
			ctx,
			glyph,
			(cell) => (cell === "k" ? OUTLINE : null),
			Math.round(x - width / 2 + 1 + index * 4),
			y,
		);
	});
}

/** An agent waiting on your answer raises its hand. */
function drawRaisedHand(
	ctx: CanvasRenderingContext2D,
	frame: CharacterFrame,
	seed: number,
	timeMs: number,
	reducedMotion: boolean,
) {
	if (frame.bubble !== "approval") return;
	const wave = reducedMotion ? 0 : Math.floor(timeMs / 400) % 2;
	// From the right shoulder up past the head.
	const x = Math.round(frame.x * T) + 13 + wave;
	const y = Math.round(frame.y * T) - 4;
	const palette = characterPalette(seed);
	ctx.fillStyle = OUTLINE;
	ctx.fillRect(x - 1, y - 1, 4, 14);
	ctx.fillStyle = palette.s;
	ctx.fillRect(x, y, 2, 3);
	ctx.fillStyle = palette.c;
	ctx.fillRect(x, y + 3, 2, 9);
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
	for (const { room, color } of scene.rooms) {
		drawRoom(ctx, room, color);
		for (const desk of room.desks) drawCubicle(ctx, desk);
	}

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
	for (const workflow of scene.workflows) {
		drawWorkflow(ctx, workflow, timeMs, reducedMotion);
	}
	const agentBySeat = new Map(scene.agents.map((agent) => [agent.seat, agent]));
	for (const { room } of scene.rooms) {
		for (const desk of room.desks) {
			drawTables(ctx, desk);
			for (const seat of desk.seats) {
				drawWorkstation(
					ctx,
					seat,
					agentBySeat.get(seat),
					timeMs,
					reducedMotion,
				);
			}
			if (scene.emptyDesks.has(desk.id)) dimDesk(ctx, desk);
		}
	}
	drawHelperLinks(ctx, scene.helpers);
	for (const helper of scene.helpers) {
		drawSmallWorker(
			ctx,
			helper.at,
			helper.seed,
			HELPER_SCALE,
			timeMs,
			reducedMotion,
		);
	}
	for (const extra of scene.extraHelpers) {
		drawPlus(ctx, extra.count, extra.at.x * T, extra.at.y * T + 3);
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
	for (const { agent, frame } of frames) {
		drawRaisedHand(ctx, frame, agent.seed, timeMs, reducedMotion);
	}
}
