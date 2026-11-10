/** Tile units throughout; a tile is `TILE_SIZE` art pixels. */
export const TILE_SIZE = 16;
export const WALL_HEIGHT = 3;
export const CORRIDOR_X = 2;
/** Seats along one desk before it wraps into another row. */
export const SEATS_PER_ROW = 4;
export const DEVICES_PER_RACK = 4;

/** A seat's desk is two tiles wide; one more keeps room for its bubble. */
export const COLUMN_PITCH = 3;
/** Bubble, agent, desk. */
export const ROW_PITCH = 3;
/** The room's name and counters, along its top. */
export const HEADER_HEIGHT = 1;
/** The workspace's name plate, along the top of its cubicle. */
export const PLATE_HEIGHT = 1;
/** Room padding around its cubicles. */
export const ROOM_PAD = 1;
/** Between two cubicles of a room. */
export const DESK_GAP = 1;
/** The strip under a row of seats where their subagents work. */
export const HELPER_ROW = 1;
/** A subagent is drawn smaller than its parent. */
export const HELPER_SCALE = 0.625;
export const HELPER_PITCH = 0.7;
export const HELPERS_PER_SEAT = 4;
/** A workflow's table: its name, then its agents behind the table. */
export const WORKFLOW_HEIGHT = 3;
export const WORKFLOW_SCALE = 0.75;
export const WORKFLOW_PITCH = 1;
export const WORKFLOW_MAX_AGENTS = 8;
/** Between two floors of rooms: the corridor idle agents walk along. */
export const HALLWAY = 1;

const MIN_DESK_WIDTH = 7;
const MIN_ROOM_WIDTH = 10;
const MAX_ROOM_INNER_WIDTH = 46;
const FIRST_ROOM_X = 4;
const MIN_WIDTH = 16;
/** Wider than tall, like the window the building is fitted into. */
const DEFAULT_ASPECT = 1.6;

export interface Point {
	x: number;
	y: number;
}

/** Where a character sits: the tile above its desk. */
export interface OfficeSeat extends Point {
	desk: Point;
	/** Top-left of each subagent shown in the strip under the desk. */
	helpers: Point[];
	/** Subagents past `HELPERS_PER_SEAT`, counted on the last one. */
	extraHelpers: number;
}

/** One workflow run: a meeting table with its agents behind it. */
export interface OfficeWorkflow {
	id: string;
	x: number;
	y: number;
	width: number;
	label: Point & { width: number };
	table: Point & { width: number };
	agents: Point[];
	extraAgents: number;
}

/** One workspace: a cubicle with its name plate and a seat per chat. */
export interface OfficeDesk {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	plate: Point & { width: number };
	seats: OfficeSeat[];
	workflows: OfficeWorkflow[];
}

/** One group (sidebar folder or project): a room of cubicles. */
export interface OfficeRoom {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	header: Point & { width: number };
	desks: OfficeDesk[];
}

export interface OfficeLayout {
	width: number;
	height: number;
	rooms: OfficeRoom[];
	/** The coffee counter, two tiles wide, against the wall. */
	coffee: Point;
	/** Where an idle agent stands to get a coffee. */
	coffeeSpot: Point;
	/** Server racks against the wall, two tiles wide each. */
	racks: Point[];
	plants: Point[];
}

export interface DeskInput {
	id: string;
	/** The number of chats; an empty workspace still gets a desk. */
	seats: number;
	/** Live subagents of each chat, in seat order. */
	helpers?: readonly number[];
	/** One entry per workflow run in this workspace: its live agents. */
	workflows?: readonly { id: string; agents: number }[];
}

export interface RoomInput {
	id: string;
	desks: DeskInput[];
}

function workflowWidth(agents: number): number {
	return (
		Math.min(Math.max(agents, 1), WORKFLOW_MAX_AGENTS) * WORKFLOW_PITCH + 3
	);
}

export function deskSize(
	seats: number,
	helpers: readonly number[] = [],
	workflows: readonly { agents: number }[] = [],
) {
	const columns = Math.min(Math.max(seats, 1), SEATS_PER_ROW);
	const rows = Math.max(1, Math.ceil(seats / SEATS_PER_ROW));
	const rowHasHelpers = Array.from({ length: rows }, (_, row) =>
		helpers
			.slice(row * SEATS_PER_ROW, (row + 1) * SEATS_PER_ROW)
			.some((count) => count > 0),
	);
	const helperRows = rowHasHelpers.filter(Boolean).length;
	const widestWorkflow = workflows.reduce(
		(max, workflow) => Math.max(max, workflowWidth(workflow.agents)),
		0,
	);
	return {
		columns,
		rows,
		rowHasHelpers,
		width: Math.max(
			columns * COLUMN_PITCH + 1,
			MIN_DESK_WIDTH,
			widestWorkflow + 2,
		),
		height:
			PLATE_HEIGHT +
			rows * ROW_PITCH +
			helperRows * HELPER_ROW +
			workflows.length * WORKFLOW_HEIGHT +
			1,
	};
}

function placeDesk(input: DeskInput, deskX: number, deskY: number): OfficeDesk {
	const helpers = input.helpers ?? [];
	const workflows = input.workflows ?? [];
	const size = deskSize(input.seats, helpers, workflows);
	const seats: OfficeSeat[] = [];
	let rowTop = deskY + PLATE_HEIGHT;
	for (let row = 0; row < size.rows; row++) {
		const first = row * size.columns;
		const last = Math.min(Math.max(input.seats, 1), first + size.columns);
		for (let index = first; index < last; index++) {
			const column = index - first;
			const columnX = deskX + 1 + column * COLUMN_PITCH;
			const seatX = columnX + 0.5;
			// The tile above the agent holds its bubble.
			const seatY = rowTop + 1;
			const count = helpers[index] ?? 0;
			const shown = Math.min(count, HELPERS_PER_SEAT);
			seats.push({
				x: seatX,
				y: seatY,
				desk: { x: seatX - 0.5, y: seatY + 1 },
				helpers: Array.from({ length: shown }, (_, helper) => ({
					x: columnX + helper * HELPER_PITCH,
					y: rowTop + ROW_PITCH,
				})),
				extraHelpers: count - shown,
			});
		}
		rowTop += ROW_PITCH + (size.rowHasHelpers[row] ? HELPER_ROW : 0);
	}
	const placedWorkflows = workflows.map((workflow, index) => {
		const y = rowTop + index * WORKFLOW_HEIGHT;
		const width = workflowWidth(workflow.agents);
		const x = deskX + 1;
		const shown = Math.min(workflow.agents, WORKFLOW_MAX_AGENTS);
		return {
			id: workflow.id,
			x,
			y,
			width,
			label: { x, y, width },
			table: { x: x + 0.5, y: y + 1.75, width: width - 1 },
			agents: Array.from({ length: shown }, (_, agent) => ({
				x: x + 1.5 + agent * WORKFLOW_PITCH,
				y: y + 1,
			})),
			extraAgents: workflow.agents - shown,
		};
	});
	return {
		id: input.id,
		x: deskX,
		y: deskY,
		width: size.width,
		height: size.height,
		plate: { x: deskX, y: deskY, width: size.width },
		seats,
		workflows: placedWorkflows,
	};
}

/** Cubicles flow left to right and wrap, aiming for a squarish room. */
function placeDesks(
	room: RoomInput,
	x: number,
	y: number,
): { desks: OfficeDesk[]; width: number; height: number } {
	const sizes = room.desks.map((desk) =>
		deskSize(desk.seats, desk.helpers, desk.workflows),
	);
	const widest = sizes.reduce((max, size) => Math.max(max, size.width), 0);
	const area = sizes.reduce(
		(sum, size) => sum + (size.width + DESK_GAP) * (size.height + DESK_GAP),
		0,
	);
	const innerWidth = Math.max(
		widest,
		Math.min(MAX_ROOM_INNER_WIDTH, Math.round(Math.sqrt(area * 1.8))),
	);

	const desks: OfficeDesk[] = [];
	let dx = 0;
	let dy = 0;
	let rowHeight = 0;
	let usedWidth = 0;
	room.desks.forEach((input, index) => {
		const size = sizes[index] as ReturnType<typeof deskSize>;
		if (dx > 0 && dx + size.width > innerWidth) {
			dx = 0;
			dy += rowHeight + DESK_GAP;
			rowHeight = 0;
		}
		desks.push(placeDesk(input, x + ROOM_PAD + dx, y + HEADER_HEIGHT + dy));
		dx += size.width + DESK_GAP;
		usedWidth = Math.max(usedWidth, dx - DESK_GAP);
		rowHeight = Math.max(rowHeight, size.height);
	});
	return {
		desks,
		width: Math.max(usedWidth + 2 * ROOM_PAD, MIN_ROOM_WIDTH),
		height: HEADER_HEIGHT + dy + rowHeight + ROOM_PAD,
	};
}

/**
 * One building: rooms side by side, wall against wall, in floors separated
 * by a corridor, and a corridor down the left side that idle agents walk to
 * reach the coffee counter. Each floor is as long as the widest one, so the
 * building is a rectangle sized to `aspect` rather than to the window width.
 */
export function layoutOffice({
	rooms,
	devices,
	aspect = DEFAULT_ASPECT,
}: {
	rooms: RoomInput[];
	devices: number;
	/** Width over height of the space the building is shown in. */
	aspect?: number;
}): OfficeLayout {
	const rackCount = Math.max(1, Math.ceil(devices / DEVICES_PER_RACK));
	const measured = rooms.map((room) => placeDesks(room, 0, 0));
	const widestRoom = measured.reduce(
		(max, room) => Math.max(max, room.width),
		0,
	);
	const area = measured.reduce(
		(sum, room) => sum + room.width * room.height,
		0,
	);
	const floorTarget = Math.max(
		widestRoom,
		Math.round(Math.sqrt(area * Math.max(aspect, 0.5))),
	);

	const floors: number[][] = [];
	let floorWidth = 0;
	measured.forEach((room, index) => {
		const current = floors.at(-1);
		if (!current || floorWidth + room.width > floorTarget) {
			floors.push([index]);
			floorWidth = room.width;
		} else {
			current.push(index);
			floorWidth += room.width;
		}
	});
	const innerWidth = Math.max(
		floors.reduce(
			(max, floor) =>
				Math.max(
					max,
					floor.reduce((sum, index) => sum + (measured[index]?.width ?? 0), 0),
				),
			0,
		),
		MIN_ROOM_WIDTH,
	);
	const width = Math.max(
		FIRST_ROOM_X + innerWidth + 1,
		MIN_WIDTH,
		FIRST_ROOM_X + rackCount * 3 + 2,
	);

	const placed: OfficeRoom[] = [];
	let y = WALL_HEIGHT + HALLWAY;
	for (const floor of floors) {
		const floorHeight = floor.reduce(
			(max, index) => Math.max(max, measured[index]?.height ?? 0),
			0,
		);
		let x = FIRST_ROOM_X;
		floor.forEach((index, position) => {
			const room = rooms[index] as RoomInput;
			const size = measured[index] as { width: number };
			// The last room takes what the floor has left, so walls line up.
			const roomWidth =
				position === floor.length - 1
					? FIRST_ROOM_X + innerWidth - x
					: size.width;
			const { desks } = placeDesks(room, x, y);
			placed.push({
				id: room.id,
				x,
				y,
				width: roomWidth,
				height: floorHeight,
				header: { x, y, width: roomWidth },
				desks,
			});
			x += roomWidth;
		});
		y += floorHeight + HALLWAY;
	}

	const height = Math.max(y, WALL_HEIGHT + 6);
	const racks = Array.from({ length: rackCount }, (_, index) => ({
		x: width - 3 - index * 3,
		y: WALL_HEIGHT - 1,
	}));

	return {
		width,
		height,
		rooms: placed,
		coffee: { x: 0, y: WALL_HEIGHT - 1 },
		coffeeSpot: { x: CORRIDOR_X, y: WALL_HEIGHT },
		racks,
		plants: [
			{ x: 0, y: height - 1 },
			{ x: width - 1, y: height - 1 },
			{ x: 3, y: WALL_HEIGHT },
		],
	};
}

/**
 * The way from a seat to the coffee counter: out of the room by its left
 * wall, along the corridor above its floor, then up the left corridor.
 */
export function pathToCoffee(
	room: Point,
	seat: Point,
	layout: Pick<OfficeLayout, "coffeeSpot">,
): Point[] {
	const corridorY = room.y - HALLWAY;
	const points: Point[] = [
		{ x: seat.x, y: seat.y },
		{ x: room.x, y: seat.y },
		{ x: room.x, y: corridorY },
		{ x: CORRIDOR_X, y: corridorY },
		{ x: CORRIDOR_X, y: layout.coffeeSpot.y },
		layout.coffeeSpot,
	];
	return points.filter(
		(point, index) =>
			index === 0 ||
			point.x !== points[index - 1]?.x ||
			point.y !== points[index - 1]?.y,
	);
}
