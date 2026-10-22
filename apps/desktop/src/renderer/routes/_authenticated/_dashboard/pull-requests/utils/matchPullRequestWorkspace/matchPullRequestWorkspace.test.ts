import { describe, expect, it } from "bun:test";
import {
	branchKey,
	indexWorkspacesByBranch,
	pickWorkspaceConversation,
} from "./matchPullRequestWorkspace";

describe("indexWorkspacesByBranch", () => {
	it("keys live project workspaces by project and branch", () => {
		const index = indexWorkspacesByBranch([
			{ id: "a", projectId: "p1", branch: "feat/x" },
			{ id: "b", projectId: "p1", branch: "feat/y", archivedAt: 1 },
			{ id: "c", projectId: null, branch: "feat/x" },
			{ id: "d", projectId: "p2", branch: "feat/x" },
		]);
		expect(index.get(branchKey("p1", "feat/x"))?.id).toBe("a");
		expect(index.get(branchKey("p2", "feat/x"))?.id).toBe("d");
		expect(index.has(branchKey("p1", "feat/y"))).toBe(false);
		expect(index.size).toBe(2);
	});
});

describe("pickWorkspaceConversation", () => {
	it("prefers a conversation waiting on the user, then the latest", () => {
		const conversations = [
			{
				terminalId: "t1",
				workspaceId: "w",
				state: "working" as const,
				since: 30,
			},
			{ terminalId: "t2", workspaceId: "w", state: "seen" as const, since: 10 },
			{
				terminalId: "t3",
				workspaceId: "w",
				state: "unseen" as const,
				since: 20,
			},
			{
				terminalId: "t4",
				workspaceId: "other",
				state: "request" as const,
				since: 99,
			},
		];
		expect(pickWorkspaceConversation(conversations, "w")?.terminalId).toBe(
			"t3",
		);
		expect(
			pickWorkspaceConversation(conversations.slice(0, 1), "w")?.terminalId,
		).toBe("t1");
		expect(pickWorkspaceConversation(conversations, "none")).toBeNull();
	});
});
