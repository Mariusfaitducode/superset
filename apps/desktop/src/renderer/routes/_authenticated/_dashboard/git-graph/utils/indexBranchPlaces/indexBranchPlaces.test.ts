import { describe, expect, it } from "bun:test";
import { indexBranchPlaces } from "./indexBranchPlaces";

describe("indexBranchPlaces", () => {
	it("joins worktrees, workspaces and the conversation to open by branch", () => {
		const places = indexBranchPlaces({
			projectId: "p",
			worktrees: [
				{ path: "/repo", branch: "main" },
				{ path: "/wt/feat", branch: "feat" },
				{ path: "/wt/detached", branch: null },
			],
			workspaces: [
				{ id: "w1", projectId: "p", branch: "feat" },
				{ id: "w2", projectId: "other", branch: "main" },
				{ id: "w3", projectId: "p", branch: "old", archivedAt: 1 },
			],
			conversations: [
				{ workspaceId: "w1", state: "working", since: 30 },
				{ workspaceId: "w1", state: "unseen", since: 10 },
				{ workspaceId: "w2", state: "unseen", since: 50 },
			],
		});
		expect(places.get("main")).toEqual({
			worktreePath: "/repo",
			workspace: null,
			conversation: null,
		});
		expect(places.get("feat")).toMatchObject({
			worktreePath: "/wt/feat",
			workspace: { id: "w1" },
			conversation: { state: "unseen", since: 10 },
		});
		expect(places.has("old")).toBe(false);
	});
});
