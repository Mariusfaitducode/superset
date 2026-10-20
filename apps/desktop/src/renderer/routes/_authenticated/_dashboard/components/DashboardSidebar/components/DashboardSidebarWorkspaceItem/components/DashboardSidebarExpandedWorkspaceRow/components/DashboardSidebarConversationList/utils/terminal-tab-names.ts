interface LayoutPane {
	kind?: unknown;
	titleOverride?: unknown;
	data?: { terminalId?: unknown } | null;
}

interface LayoutTab {
	titleOverride?: unknown;
	panes?: Record<string, LayoutPane>;
}

const named = (value: unknown): string | null =>
	typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * `terminalId → name the user gave it` from a workspace's saved pane layout:
 * the pane's own name, else its tab's. The layout is read from local storage
 * as-is, so anything unexpected is skipped rather than trusted.
 */
export function terminalTabNames(paneLayout: unknown): Map<string, string> {
	const names = new Map<string, string>();
	const tabs = (paneLayout as { tabs?: unknown } | undefined)?.tabs;
	if (!Array.isArray(tabs)) return names;
	for (const tab of tabs as LayoutTab[]) {
		for (const pane of Object.values(tab?.panes ?? {})) {
			const terminalId = pane?.data?.terminalId;
			if (pane?.kind !== "terminal" || typeof terminalId !== "string") continue;
			const name = named(pane.titleOverride) ?? named(tab.titleOverride);
			if (name) names.set(terminalId, name);
		}
	}
	return names;
}
