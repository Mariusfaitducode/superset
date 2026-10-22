import { beforeEach, describe, expect, test } from "bun:test";
import { MAX_OPEN_PANELS, useWorkspaceIdeasPanelStore } from "./store";

describe("workspace ideas panel", () => {
	beforeEach(() =>
		useWorkspaceIdeasPanelStore.setState({
			openWorkspaceIds: [],
			showAll: false,
		}),
	);

	test("opens and closes a workspace's panel", () => {
		const { toggle } = useWorkspaceIdeasPanelStore.getState();
		toggle("ws-1");
		toggle("ws-2");
		toggle("ws-1");
		expect(useWorkspaceIdeasPanelStore.getState().openWorkspaceIds).toEqual([
			"ws-2",
		]);
	});

	test("keeps only the most recently opened panels", () => {
		const { toggle } = useWorkspaceIdeasPanelStore.getState();
		for (let i = 0; i <= MAX_OPEN_PANELS; i++) toggle(`ws-${i}`);
		const open = useWorkspaceIdeasPanelStore.getState().openWorkspaceIds;
		expect(open).toHaveLength(MAX_OPEN_PANELS);
		expect(open[0]).toBe("ws-1");
	});
});
