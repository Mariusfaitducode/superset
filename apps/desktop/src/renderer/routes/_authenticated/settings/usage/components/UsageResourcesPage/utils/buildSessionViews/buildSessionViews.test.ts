import { describe, expect, it } from "bun:test";
import type { ResourceMetricsSnapshot } from "renderer/routes/_authenticated/_dashboard/components/TopBar/components/ResourceConsumption/types";
import type { AgentSessionRow } from "../../types";
import { buildSessionViews } from "./buildSessionViews";

const row = (overrides: Partial<AgentSessionRow>): AgentSessionRow => ({
	pid: 1,
	sessionId: "1d81ec3e-6104",
	cwd: "/Users/me/worktrees/fix-login",
	name: "fix-login-20",
	status: "idle",
	waitingFor: null,
	startedAt: null,
	lastHumanAt: null,
	cpu: 0,
	memory: 0,
	processCount: 1,
	terminalId: null,
	workspaceId: null,
	...overrides,
});

const resources = {
	workspaces: [
		{
			workspaceId: "ws-1",
			projectName: "hub",
			workspaceName: "Fix login",
			sessions: [{ sessionId: "term-1", title: "Login bug" }],
		},
	],
} as unknown as ResourceMetricsSnapshot;

describe("buildSessionViews", () => {
	it("uses the pane title and workspace of the terminal it runs in", () => {
		const [view] = buildSessionViews(
			[row({ terminalId: "term-1", workspaceId: "ws-1" })],
			resources,
		);
		expect(view.title).toBe("Login bug");
		expect(view.workspaceLabel).toBe("hub / Fix login");
	});

	it("falls back on Claude's session name and the cwd outside Superset", () => {
		const [view] = buildSessionViews([row({})], resources);
		expect(view.title).toBe("fix-login-20");
		expect(view.workspaceLabel).toBe("fix-login");
	});
});
