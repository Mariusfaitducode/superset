import { beforeEach, describe, expect, test } from "bun:test";
import {
	MAX_FOLDER_ENTRIES,
	resolveFolderOptions,
	useSidebarFolderOptionsStore,
} from "./store";

describe("sidebar folder options", () => {
	beforeEach(() => {
		useSidebarFolderOptionsStore.setState({ byFolder: {} });
	});

	test("removes a folder once its last option is off", () => {
		const { setOption } = useSidebarFolderOptionsStore.getState();
		setOption({ kind: "project", id: "p1" }, "hideTodos", true);
		setOption({ kind: "project", id: "p1" }, "hideTodos", false);
		expect(useSidebarFolderOptionsStore.getState().byFolder).toEqual({});
	});

	test("a group adds its options to its project's", () => {
		const { setOption } = useSidebarFolderOptionsStore.getState();
		setOption({ kind: "project", id: "p1" }, "hideSubagents", true);
		setOption({ kind: "group", id: "g1" }, "compactRows", true);
		const options = resolveFolderOptions(
			useSidebarFolderOptionsStore.getState().byFolder,
			"p1",
			"g1",
		);
		expect(options.hideSubagents).toBe(true);
		expect(options.compactRows).toBe(true);
		expect(options.hideTodos).toBe(false);
	});

	test("keeps at most MAX_FOLDER_ENTRIES folders, dropping the oldest", () => {
		const { setOption } = useSidebarFolderOptionsStore.getState();
		for (let index = 0; index <= MAX_FOLDER_ENTRIES; index++) {
			setOption({ kind: "group", id: `g${index}` }, "hideTodos", true);
		}
		const byFolder = useSidebarFolderOptionsStore.getState().byFolder;
		expect(Object.keys(byFolder)).toHaveLength(MAX_FOLDER_ENTRIES);
		expect(byFolder["group:g0"]).toBeUndefined();
		expect(byFolder[`group:g${MAX_FOLDER_ENTRIES}`]).toBeDefined();
	});
});
