/** Card geometry of the Ctrl+Tab strip, in px; mirrors its Tailwind classes. */
export const CARD_MIN_WIDTH = 176;
const CARD_GAP = 10;
const STRIP_PADDING = 2 * 10;
const SCREEN_MARGIN = 2 * 16;
const HINT_WIDTH = 32;

/** How many cards fit beside each other, with or without the "+N" hints. */
export function cardCapacity(
	viewportWidth: number,
	withHints: boolean,
): number {
	const hints = withHints ? 2 * (HINT_WIDTH + CARD_GAP) : 0;
	const room = viewportWidth - SCREEN_MARGIN - STRIP_PADDING - hints;
	return Math.max(
		1,
		Math.floor((room + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP)),
	);
}

export interface CardWindow {
	start: number;
	/** Cards shown; every card when they all fit. */
	size: number;
}

/**
 * The cards shown when they don't all fit. The window only moves when the
 * selection leaves it, by as little as needed, so the strip stays put while
 * Tab walks through the visible cards.
 */
export function slideCardWindow({
	previousStart,
	index,
	count,
	viewportWidth,
}: {
	previousStart: number;
	index: number;
	count: number;
	viewportWidth: number;
}): CardWindow {
	if (count <= cardCapacity(viewportWidth, false)) {
		return { start: 0, size: count };
	}
	const size = Math.min(count, cardCapacity(viewportWidth, true));
	let start = Math.min(Math.max(previousStart, 0), count - size);
	if (index < start) start = index;
	else if (index >= start + size) start = index - size + 1;
	return { start, size };
}
