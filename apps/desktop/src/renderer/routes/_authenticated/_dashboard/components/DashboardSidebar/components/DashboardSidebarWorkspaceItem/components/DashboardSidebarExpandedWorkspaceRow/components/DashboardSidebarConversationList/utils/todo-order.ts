export interface OrderableTodo {
	done: boolean;
	priority: "high" | "normal" | "low";
	dueOn: string | null;
	createdAt: number;
}

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

/**
 * Open before checked, then by priority, then the nearest due day first (no
 * due day last), then oldest first so a list keeps its order as it grows.
 */
export function compareTodos(a: OrderableTodo, b: OrderableTodo): number {
	if (a.done !== b.done) return a.done ? 1 : -1;
	const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
	if (priority !== 0) return priority;
	if (a.dueOn !== b.dueOn) {
		if (a.dueOn === null) return 1;
		if (b.dueOn === null) return -1;
		return a.dueOn < b.dueOn ? -1 : 1;
	}
	return a.createdAt - b.createdAt;
}

/** `today` is the local calendar day, `YYYY-MM-DD`. */
export function dueState(
	dueOn: string | null,
	today: string,
): "overdue" | "today" | "later" | null {
	if (dueOn === null) return null;
	if (dueOn < today) return "overdue";
	return dueOn === today ? "today" : "later";
}

export function localDay(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
