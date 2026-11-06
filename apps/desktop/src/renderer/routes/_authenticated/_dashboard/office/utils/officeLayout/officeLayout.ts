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

const MIN_DESK_WIDTH = 7;
const MIN_ROOM_WIDTH = 10;
const FIRST_ROOM_X = 4;
const GAP = 2;
const MIN_WIDTH = 16;

export interface Point {
	x: number;
	y: number;
}

/** Where a character sits: the tile above its desk. */
export interface OfficeSeat extends Point {
	desk: Point;
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

export interface RoomInput {
	id: string;
	/** `seats` is the number of chats; an empty workspace still gets a desk. */
	desks: { id: string; seats: number }[];
}

export function deskSize(seats: number) {
	const columns = Math.min(Math.max(seats, 1), SEATS_PER_ROW);
	const rows = Math.max(1, Math.ceil(seats / SEATS_PER_ROW));
	return {
		columns,
		rows,
		width: Math.max(columns * COLUMN_PITCH + 1, MIN_DESK_WIDTH),
		height: PLATE_HEIGHT + rows * ROW_PITCH + 1,
	};
}

function placeDesks(
	room: RoomInput,
	x: number,
	y: number,
	innerWidth: number,
): { desks: OfficeDesk[]; width: number; height: number } {
	const desks: OfficeDesk[] = [];
	let dx = 0;
	let dy = 0;
	let rowHeight = 0;
	let usedWidth = 0;
	for (const input of room.desks) {
		const size = deskSize(input.seats);
		if (dx > 0 && dx + size.width > innerWidth) {
			dx = 0;
			dy += rowHeight + DESK_GAP;
			rowHeight = 0;
		}
		const deskX = x + ROOM_PAD + dx;
		const deskY = y + HEADER_HEIGHT + dy;
		const seats: OfficeSeat[] = [];
		for (let index = 0; index < Math.max(input.seats, 1); index++) {
			const column = index % size.columns;
			const row = Math.floor(index / size.columns);
			const seatX = deskX + 1 + column * COLUMN_PITCH + 0.5;
			// The tile above the agent holds its bubble.
			const seatY = deskY + PLATE_HEIGHT + 1 + row * ROW_PITCH;
			seats.push({
				x: seatX,
				y: seatY,
				desk: { x: seatX - 0.5, y: seatY + 1 },
			});
		}
		desks.push({
			id: input.id,
			x: deskX,
			y: deskY,
			width: size.width,
			height: size.height,
			plate: { x: deskX, y: deskY, width: size.width },
			seats,
		});
		dx += size.width + DESK_GAP;
		usedWidth = Math.max(usedWidth, dx - DESK_GAP);
		rowHeight = Math.max(rowHeight, size.height);
	}
	return {
		desks,
		width: Math.max(usedWidth + 2 * ROOM_PAD, MIN_ROOM_WIDTH),
		height: HEADER_HEIGHT + dy + rowHeight + ROOM_PAD,
	};
}

/**
 * Places one room per group, in the given order, left to right then in
 * rows, with a corridor above each row and down the left side that idle
 * agents walk to reach the coffee counter. Inside a room, cubicles flow the
 * same way and wrap at the office's width.
 */
export function layoutOffice({
	rooms,
	maxWidth,
	devices,
}: {
	rooms: RoomInput[];
	maxWidth: number;
	devices: number;
}): OfficeLayout {
	const rackCount = Math.max(1, Math.ceil(devices / DEVICES_PER_RACK));
	const widestDesk = rooms.reduce(
		(max, room) =>
			room.desks.reduce(
				(inner, desk) => Math.max(inner, deskSize(desk.seats).width),
				max,
			),
		0,
	);
	const width = Math.max(
		Math.floor(maxWidth),
		MIN_WIDTH,
		FIRST_ROOM_X + Math.max(widestDesk + 2 * ROOM_PAD, MIN_ROOM_WIDTH) + 1,
		FIRST_ROOM_X + rackCount * 3 + 2,
	);
	const innerWidth = width - FIRST_ROOM_X - 1 - 2 * ROOM_PAD;

	const placed: OfficeRoom[] = [];
	let x = FIRST_ROOM_X;
	let y = WALL_HEIGHT + GAP;
	let rowHeight = 0;
	for (const room of rooms) {
		// Measure first, then place where it fits.
		const measured = placeDesks(room, 0, 0, innerWidth);
		if (x > FIRST_ROOM_X && x + measured.width > width - 1) {
			x = FIRST_ROOM_X;
			y += rowHeight + GAP;
			rowHeight = 0;
		}
		const { desks } = placeDesks(room, x, y, innerWidth);
		placed.push({
			id: room.id,
			x,
			y,
			width: measured.width,
			height: measured.height,
			header: { x, y, width: measured.width },
			desks,
		});
		x += measured.width + GAP;
		rowHeight = Math.max(rowHeight, measured.height);
	}

	const height = Math.max(y + rowHeight + 1, WALL_HEIGHT + 6);
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
 * edge, along the corridor above its row, then up the left corridor.
 */
export function pathToCoffee(
	room: Point,
	seat: Point,
	layout: Pick<OfficeLayout, "coffeeSpot">,
): Point[] {
	const corridorY = room.y - 1;
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
