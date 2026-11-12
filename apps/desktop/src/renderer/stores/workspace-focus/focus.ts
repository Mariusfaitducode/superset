/**
 * Whether the "Focus only" filter actually hides anything: with no workspace
 * in focus it would empty every view, so it rests until one is.
 */
export function isFocusFilterOn(state: {
	ids: readonly string[];
	focusOnly: boolean;
}): boolean {
	return state.focusOnly && state.ids.length > 0;
}

/**
 * Keeps the items whose workspace is in focus; returns `items` itself when
 * `on` is false, so memoized lists keep their identity.
 */
export function keepFocused<T>(
	items: T[],
	workspaceIdOf: (item: T) => string | null,
	focused: ReadonlySet<string>,
	on: boolean,
): T[] {
	if (!on) return items;
	return items.filter((item) => {
		const id = workspaceIdOf(item);
		return id !== null && focused.has(id);
	});
}
