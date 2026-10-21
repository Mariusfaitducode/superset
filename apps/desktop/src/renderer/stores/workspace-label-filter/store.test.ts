import { beforeEach, describe, expect, test } from "bun:test";
import { useWorkspaceLabelFilterStore } from "./store";

describe("workspace label filter", () => {
	beforeEach(() => useWorkspaceLabelFilterStore.setState({ selected: [] }));

	test("toggles a label by name, ignoring case", () => {
		const { toggle } = useWorkspaceLabelFilterStore.getState();
		toggle("Today");
		toggle("Waiting");
		toggle("today");
		expect(useWorkspaceLabelFilterStore.getState().selected).toEqual([
			"Waiting",
		]);
		useWorkspaceLabelFilterStore.getState().clear();
		expect(useWorkspaceLabelFilterStore.getState().selected).toEqual([]);
	});
});
