import type { WorkspaceStore } from "@superset/panes";
import { useEffect } from "react";
import { getV2NotificationSourcesForPane } from "renderer/stores/v2-notifications";
import {
	useVisibleTerminalsStore,
	type VisibleTerminalSlot,
} from "renderer/stores/visible-terminals";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import type { PaneViewerData } from "../../types";

export function useReportVisibleTerminal({
	store,
	slot,
	enabled = true,
}: {
	store: StoreApi<WorkspaceStore<PaneViewerData>>;
	slot: VisibleTerminalSlot;
	enabled?: boolean;
}): void {
	const terminalId = useStore(store, (state) => {
		const tab = state.tabs.find(
			(candidate) => candidate.id === state.activeTabId,
		);
		const pane = tab?.activePaneId ? tab.panes[tab.activePaneId] : undefined;
		return getV2NotificationSourcesForPane(pane)[0]?.id ?? null;
	});
	const setVisibleTerminal = useVisibleTerminalsStore(
		(state) => state.setVisibleTerminal,
	);

	useEffect(() => {
		setVisibleTerminal(slot, enabled ? terminalId : null);
		return () => setVisibleTerminal(slot, null);
	}, [enabled, slot, terminalId, setVisibleTerminal]);
}
