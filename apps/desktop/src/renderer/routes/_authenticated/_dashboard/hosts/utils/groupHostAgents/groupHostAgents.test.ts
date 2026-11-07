import { describe, expect, test } from "bun:test";
import { groupHostAgents, type HostAgentBinding } from "./groupHostAgents";

const workspaces = [
	{ id: "w-api", name: "api", branch: "fix-auth" },
	{ id: "w-web", name: "web", branch: "main" },
	{ id: "w-docs", name: "docs", branch: "docs" },
];

function binding(
	overrides: Partial<HostAgentBinding> & { terminalId: string },
): HostAgentBinding {
	return {
		workspaceId: "w-api",
		agentId: "claude",
		lastEventType: "Start",
		lastEventAt: 100,
		...overrides,
	};
}

describe("groupHostAgents", () => {
	test("groups live agents by workspace, most urgent group and agent first", () => {
		const { withAgents, withoutAgents } = groupHostAgents({
			workspaces,
			bindings: [
				binding({ terminalId: "t1", lastEventAt: 300 }),
				binding({
					terminalId: "t2",
					workspaceId: "w-web",
					lastEventType: "PermissionRequest",
				}),
				binding({ terminalId: "t3", lastEventType: "Stop", lastEventAt: 200 }),
				binding({ terminalId: "t4", workspaceId: "w-docs", endedAt: 400 }),
			],
			terminalSeenAt: { t3: 250 },
			titles: new Map([["t1", "Fix login"]]),
		});
		expect(withAgents.map((group) => group.workspace.id)).toEqual([
			"w-web",
			"w-api",
		]);
		expect(withAgents[0]?.state).toBe("needsYou");
		expect(withAgents[1]?.agents).toEqual([
			{
				terminalId: "t1",
				agentId: "claude",
				title: "Fix login",
				state: "working",
				lastEventAt: 300,
				subagentCount: 0,
			},
			{
				terminalId: "t3",
				agentId: "claude",
				title: null,
				state: "idle",
				lastEventAt: 200,
				subagentCount: 0,
			},
		]);
		expect(withoutAgents.map((workspace) => workspace.id)).toEqual(["w-docs"]);
	});

	test("an unseen finished turn reads as unseen", () => {
		const { withAgents } = groupHostAgents({
			workspaces,
			bindings: [
				binding({ terminalId: "t1", lastEventType: "Stop", lastEventAt: 200 }),
			],
			terminalSeenAt: {},
			titles: new Map(),
		});
		expect(withAgents[0]?.state).toBe("unseen");
	});
});
