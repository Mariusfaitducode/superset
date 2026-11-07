import { describe, expect, it } from "bun:test";
import { migrateGitGraphState, useGitGraphStore } from "./gitGraphStore";

describe("migrateGitGraphState", () => {
	it("keeps valid refs and defaults the rest", () => {
		expect(
			migrateGitGraphState({
				projectId: "p1",
				refsByProject: {
					p1: ["refs/heads/main", "main", 3, "refs/tags/v1"],
					p2: "nope",
				},
				showRemotes: true,
			}),
		).toEqual({
			projectId: "p1",
			recentProjectIds: [],
			refsByProject: { p1: ["refs/heads/main", "refs/tags/v1"] },
			showRemotes: true,
			showTags: true,
			worktreesOnly: false,
		});
	});
});

describe("setProjectId", () => {
	it("keeps the opened repositories most recent first, without repeats", () => {
		const { setProjectId } = useGitGraphStore.getState();
		setProjectId("a");
		setProjectId("b");
		setProjectId("a");
		expect(useGitGraphStore.getState()).toMatchObject({
			projectId: "a",
			recentProjectIds: ["a", "b"],
		});
	});
});
