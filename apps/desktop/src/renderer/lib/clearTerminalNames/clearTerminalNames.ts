import type { WorkspaceState } from "@superset/panes";

function hasTerminal(pane: { data?: unknown }, terminalId: string): boolean {
	return (
		(pane.data as { terminalId?: unknown } | null | undefined)?.terminalId ===
		terminalId
	);
}

/**
 * Drops the local names (pane and tab overrides) that would hide a
 * terminal's host-side name, so every view shows the same one. Returns the
 * layout unchanged when nothing names that terminal.
 */
export function clearTerminalNames<TData>(
	layout: WorkspaceState<TData>,
	terminalId: string,
): WorkspaceState<TData> {
	let changed = false;
	const tabs = layout.tabs.map((tab) => {
		const panes = Object.values(tab.panes);
		const terminalPanes = panes.filter((pane) => hasTerminal(pane, terminalId));
		if (terminalPanes.length === 0) return tab;
		const namesTab =
			panes.length === 1 ||
			terminalPanes.some((pane) => pane.id === tab.activePaneId);
		const clearsTab = namesTab && tab.titleOverride !== undefined;
		const clearsPane = terminalPanes.some(
			(pane) => pane.titleOverride !== undefined,
		);
		if (!clearsTab && !clearsPane) return tab;
		changed = true;
		const nextPanes = { ...tab.panes };
		for (const pane of terminalPanes) {
			const { titleOverride: _name, ...rest } = pane;
			nextPanes[pane.id] = rest;
		}
		const { titleOverride: _tabName, ...tabRest } = tab;
		return { ...(clearsTab ? tabRest : tab), panes: nextPanes };
	});
	return changed ? { ...layout, tabs } : layout;
}
