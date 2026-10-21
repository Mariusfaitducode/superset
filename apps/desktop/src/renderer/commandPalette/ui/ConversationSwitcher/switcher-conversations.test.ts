import { describe, expect, test } from "bun:test";
import {
	buildSwitcherConversations,
	matchesSwitcherQuery,
	type SwitcherBinding,
} from "./switcher-conversations";

const AT = 1_000_000;

function binding(
	terminalId: string,
	overrides: Partial<SwitcherBinding> = {},
): SwitcherBinding {
	return {
		terminalId,
		workspaceId: "ws-1",
		agentId: "claude",
		lastEventType: "Start",
		lastEventAt: AT,
		...overrides,
	};
}

const workspaces = new Map([
	["ws-1", { name: "sidebar todos", projectName: "superset" }],
	["ws-2", { name: "ctrl tab", projectName: null }],
]);

function build(bindings: SwitcherBinding[], terminalSeenAt = {}) {
	return buildSwitcherConversations({
		bindings,
		workspaces,
		terminalSeenAt,
		titles: new Map(),
		tabNames: new Map(),
	});
}

describe("buildSwitcherConversations", () => {
	test("puts conversations waiting on the user first, most recent first", () => {
		const conversations = build(
			[
				binding("working-new", { lastEventAt: AT + 50 }),
				binding("unseen-old", { lastEventType: "Stop", lastEventAt: AT }),
				binding("request-new", {
					lastEventType: "PermissionRequest",
					lastEventAt: AT + 10,
				}),
				binding("seen", { lastEventType: "Stop", lastEventAt: AT + 5 }),
			],
			{ seen: AT + 5 },
		);
		expect(conversations.map((c) => c.terminalId)).toEqual([
			"request-new",
			"seen",
			"unseen-old",
			"working-new",
		]);
		expect(conversations.map((c) => c.state)).toEqual([
			"request",
			"seen",
			"unseen",
			"working",
		]);
	});

	test("titles a conversation like the sidebar and names its workspace", () => {
		const [conversation] = buildSwitcherConversations({
			bindings: [binding("t1", { workspaceId: "ws-2" })],
			workspaces,
			terminalSeenAt: {},
			titles: new Map([["t1", { customTitle: null, runtimeTitle: "Fix CI" }]]),
			tabNames: new Map([["t1", "Claude"]]),
		});
		expect(conversation).toMatchObject({
			title: "Fix CI",
			workspaceName: "ctrl tab",
			projectName: null,
		});
	});

	test("falls back to the agent label without any title", () => {
		expect(build([binding("t1")])[0]?.title).toBe("Claude");
	});

	test("drops bindings whose workspace is gone", () => {
		expect(build([binding("t1", { workspaceId: "deleted" })])).toEqual([]);
	});
});

describe("matchesSwitcherQuery", () => {
	const [conversation] = buildSwitcherConversations({
		bindings: [binding("t1")],
		workspaces,
		terminalSeenAt: {},
		titles: new Map([["t1", { customTitle: "Review PR", runtimeTitle: null }]]),
		tabNames: new Map(),
	});
	if (!conversation) throw new Error("missing conversation");

	test("matches every word across title, workspace, project and agent", () => {
		expect(matchesSwitcherQuery(conversation, "")).toBe(true);
		expect(matchesSwitcherQuery(conversation, "review")).toBe(true);
		expect(matchesSwitcherQuery(conversation, "SUPERSET pr")).toBe(true);
		expect(matchesSwitcherQuery(conversation, "todos claude")).toBe(true);
	});

	test("rejects a query with a word found nowhere", () => {
		expect(matchesSwitcherQuery(conversation, "review codex")).toBe(false);
	});
});
