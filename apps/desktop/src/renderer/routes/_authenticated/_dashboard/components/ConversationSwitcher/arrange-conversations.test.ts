import { describe, expect, test } from "bun:test";
import type { AgentConversation } from "renderer/hooks/useAgentConversations";
import { arrangeConversations } from "./arrange-conversations";

function conversation(
	terminalId: string,
	overrides: Partial<AgentConversation> = {},
): AgentConversation {
	return {
		terminalId,
		workspaceId: "ws-1",
		agentId: "claude",
		agentLabel: "Claude",
		title: terminalId,
		workspaceName: "workspace",
		projectName: "project",
		state: "working",
		since: 0,
		...overrides,
	};
}

const ids = (sections: ReturnType<typeof arrangeConversations>) =>
	sections.map((section) => [
		section.id,
		section.conversations.map((c) => c.terminalId),
	]);

describe("arrangeConversations", () => {
	const conversations = [
		conversation("waiting", { state: "unseen" }),
		conversation("approval", { state: "request" }),
		conversation("previous"),
		conversation("current"),
		conversation("other"),
	];

	test("leads with the previous conversation so ⌘K ↵ flips back to it", () => {
		const sections = arrangeConversations({
			conversations,
			recent: ["current", "previous", "gone", "waiting"],
			currentTerminalId: "current",
			query: "",
		});
		expect(ids(sections)).toEqual([
			["recent", ["previous", "waiting"]],
			["needsYou", ["approval"]],
			["others", ["other"]],
		]);
	});

	test("caps the recent section", () => {
		const many = ["a", "b", "c", "d", "e"].map((id) => conversation(id));
		const [recent] = arrangeConversations({
			conversations: many,
			recent: ["a", "b", "c", "d", "e"],
			currentTerminalId: null,
			query: "",
		});
		expect(recent?.conversations).toHaveLength(4);
	});

	test("ranks a query by title, then by recency", () => {
		const sections = arrangeConversations({
			conversations: [
				conversation("t1", { title: "Review the sidebar fix" }),
				conversation("t2", { title: "Fix CI" }),
				conversation("t3", { title: "Prefix cleanup" }),
				conversation("t4", { title: "Docs", workspaceName: "fix-docs" }),
			],
			recent: ["t4", "t1"],
			currentTerminalId: "t2",
			query: "fix",
		});
		expect(ids(sections)).toEqual([["results", ["t2", "t1", "t4", "t3"]]]);
	});

	test("returns nothing when no conversation matches", () => {
		expect(
			arrangeConversations({
				conversations,
				recent: [],
				currentTerminalId: null,
				query: "zzz",
			}),
		).toEqual([]);
	});
});
