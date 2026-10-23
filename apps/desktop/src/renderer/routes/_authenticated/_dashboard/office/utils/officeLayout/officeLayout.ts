/** Tile units throughout; a tile is `TILE_SIZE` art pixels. */
export const TILE_SIZE = 16;
export const WALL_HEIGHT = 3;
export const CORRIDOR_X = 2;
export const SEATS_PER_ROW = 4;
export const DEVICES_PER_RACK = 4;

const FIRST_ISLAND_X = 4;
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

export interface OfficeIsland {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	seats: OfficeSeat[];
	/** The name plate, centered under the desks. */
	plate: Point & { width: number };
}

export interface OfficeLayout {
	width: number;
	height: number;
	islands: OfficeIsland[];
	/** The coffee counter, two tiles wide, against the wall. */
	coffee: Point;
	/** Where an idle agent stands to get a coffee. */
	coffeeSpot: Point;
	/** Server racks against the wall, two tiles wide each. */
	racks: Point[];
	plants: Point[];
}

function islandSize(seats: number) {
	const columns = Math.min(Math.max(seats, 1), SEATS_PER_ROW);
	const rows = Math.max(1, Math.ceil(seats / SEATS_PER_ROW));
	return { columns, rows, width: columns * 2 + 2, height: rows * 2 + 2 };
}

/**
 * Places one desk island per workspace, left to right then in rows, with a
 * corridor above each row and down the left side that idle agents walk to
 * reach the coffee counter.
 */
export function layoutOffice({
	islands,
	maxWidth,
	devices,
}: {
	islands: { id: string; seats: number }[];
	maxWidth: number;
	devices: number;
}): OfficeLayout {
	const rackCount = Math.max(1, Math.ceil(devices / DEVICES_PER_RACK));
	const widest = islands.reduce(
		(max, island) => Math.max(max, islandSize(island.seats).width),
		0,
	);
	const width = Math.max(
		Math.floor(maxWidth),
		MIN_WIDTH,
		FIRST_ISLAND_X + widest + 1,
		FIRST_ISLAND_X + rackCount * 3 + 2,
	);

	const placed: OfficeIsland[] = [];
	let x = FIRST_ISLAND_X;
	let y = WALL_HEIGHT + GAP;
	let rowHeight = 0;
	for (const island of islands) {
		const size = islandSize(island.seats);
		if (x > FIRST_ISLAND_X && x + size.width > width - 1) {
			x = FIRST_ISLAND_X;
			y += rowHeight + GAP;
			rowHeight = 0;
		}
		const seats: OfficeSeat[] = [];
		for (let index = 0; index < island.seats; index++) {
			const column = index % size.columns;
			const row = Math.floor(index / size.columns);
			const seatX = x + 1 + column * 2 + 0.5;
			const seatY = y + 1 + row * 2;
			seats.push({
				x: seatX,
				y: seatY,
				desk: { x: seatX - 0.5, y: seatY + 1 },
			});
		}
		const plateWidth = size.width - 2;
		placed.push({
			id: island.id,
			x,
			y,
			width: size.width,
			height: size.height,
			seats,
			plate: { x: x + 1, y: y + size.height - 1, width: plateWidth },
		});
		x += size.width + GAP;
		rowHeight = Math.max(rowHeight, size.height);
	}

	const height = Math.max(y + rowHeight + 1, WALL_HEIGHT + 6);
	const racks = Array.from({ length: rackCount }, (_, index) => ({
		x: width - 3 - index * 3,
		y: WALL_HEIGHT - 1,
	}));

	return {
		width,
		height,
		islands: placed,
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
 * The way from a seat to the coffee counter: out of the island by its left
 * edge, along the corridor above its row, then up the left corridor. No step
 * crosses a desk.
 */
export function pathToCoffee(
	island: OfficeIsland,
	seat: Point,
	layout: Pick<OfficeLayout, "coffeeSpot">,
): Point[] {
	const corridorY = island.y - 1;
	const points: Point[] = [
		{ x: seat.x, y: seat.y },
		{ x: island.x, y: seat.y },
		{ x: island.x, y: corridorY },
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
