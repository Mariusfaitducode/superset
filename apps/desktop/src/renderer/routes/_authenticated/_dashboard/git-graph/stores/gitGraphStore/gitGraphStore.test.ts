import { describe, expect, it } from "bun:test";
import { migrateGitGraphState } from "./gitGraphStore";

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
			refsByProject: { p1: ["refs/heads/main", "refs/tags/v1"] },
			showRemotes: true,
			showTags: true,
			worktreesOnly: false,
		});
	});
});
