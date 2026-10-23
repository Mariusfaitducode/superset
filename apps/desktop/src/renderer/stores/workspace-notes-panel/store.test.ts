import { beforeEach, describe, expect, test } from "bun:test";
import { MAX_OPEN_PANELS, useWorkspaceNotesPanelStore } from "./store";

describe("workspace notes panel", () => {
	beforeEach(() =>
		useWorkspaceNotesPanelStore.setState({
			openWorkspaceIds: [],
			showAll: false,
		}),
	);

	test("opens and closes a workspace's panel", () => {
		const { toggle } = useWorkspaceNotesPanelStore.getState();
		toggle("ws-1");
		toggle("ws-2");
		toggle("ws-1");
		expect(useWorkspaceNotesPanelStore.getState().openWorkspaceIds).toEqual([
			"ws-2",
		]);
	});

	test("keeps only the most recently opened panels", () => {
		const { toggle } = useWorkspaceNotesPanelStore.getState();
		for (let i = 0; i <= MAX_OPEN_PANELS; i++) toggle(`ws-${i}`);
		const open = useWorkspaceNotesPanelStore.getState().openWorkspaceIds;
		expect(open).toHaveLength(MAX_OPEN_PANELS);
		expect(open[0]).toBe("ws-1");
	});
});
