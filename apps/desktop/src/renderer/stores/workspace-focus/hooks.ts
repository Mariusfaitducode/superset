import { useMemo } from "react";
import { isFocusFilterOn } from "./focus";
import { useWorkspaceFocusStore } from "./store";

export function useIsWorkspaceFocused(workspaceId: string): boolean {
	return useWorkspaceFocusStore((state) => state.ids.includes(workspaceId));
}

/** The focused ids as a set, and whether the "Focus only" filter is on. */
export function useWorkspaceFocus(): {
	focused: ReadonlySet<string>;
	filterOn: boolean;
} {
	const ids = useWorkspaceFocusStore((state) => state.ids);
	const focusOnly = useWorkspaceFocusStore((state) => state.focusOnly);
	const focused = useMemo(() => new Set(ids), [ids]);
	return { focused, filterOn: isFocusFilterOn({ ids, focusOnly }) };
}
