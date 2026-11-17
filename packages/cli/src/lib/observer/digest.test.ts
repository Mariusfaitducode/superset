import { describe, expect, test } from "bun:test";
import { buildDigest, type DigestInput } from "./digest";
import { readSynthesis } from "./synthesis";

const HOUR = 3_600_000;
const now = 100 * HOUR;

function input(overrides: Partial<DigestInput> = {}): DigestInput {
	return {
		now,
		workspaces: [
			{
				id: "ws-hub",
				name: "lims-fix",
				branch: "fix/lims",
				projectName: "hub",
			},
			{ id: "ws-empty", name: "empty", branch: null, projectName: "hub" },
			{ id: "ws-observer", name: "Observer", branch: null, projectName: null },
		],
		terminals: [
			{ terminalId: "t-1", workspaceId: "ws-hub", title: "Fix the LIMS sync" },
			{ terminalId: "t-shell", workspaceId: "ws-empty", title: "zsh" },
		],
		agents: [
			{
				terminalId: "t-1",
				workspaceId: "ws-hub",
				agentId: "claude",
				lastEventType: "Stop",
				lastEventAt: now - 30 * HOUR,
				startedAt: now - 48 * HOUR,
				subagents: [{}],
			},
			{
				terminalId: "t-2",
				workspaceId: "ws-hub",
				agentId: "claude",
				lastEventType: "Start",
				lastEventAt: now - 0.1 * HOUR,
				startedAt: now - 2 * HOUR,
			},
			{
				terminalId: "t-gone",
				workspaceId: "ws-hub",
				agentId: "claude",
				lastEventType: "Stop",
				lastEventAt: now - HOUR,
				startedAt: now - 3 * HOUR,
				endedAt: now - HOUR,
			},
			{
				terminalId: "t-obs",
				workspaceId: "ws-observer",
				agentId: "claude",
				lastEventType: "Start",
				lastEventAt: now,
				startedAt: now,
			},
		],
		todos: [
			{
				workspaceId: "ws-hub",
				terminalId: "t-1",
				text: "Answer Victor",
				done: false,
				author: "user",
				priority: "high",
				kind: "message",
				dueOn: null,
			},
			{
				workspaceId: "ws-hub",
				terminalId: "t-1",
				text: "Done already",
				done: true,
				author: "user",
				priority: "normal",
				kind: "task",
				dueOn: null,
			},
		],
		reports: [
			{
				workspaceId: "ws-hub",
				terminalId: "t-2",
				kind: "decision",
				summary: "Which cache?",
				status: "open",
				createdAt: now - 5 * HOUR,
			},
			{
				workspaceId: "ws-hub",
				terminalId: "t-2",
				kind: "done",
				summary: "Old",
				status: "answered",
				createdAt: now - 50 * HOUR,
			},
		],
		notes: [
			{
				workspaceId: "ws-hub",
				text: "Superset idea: show CI in the Office",
				details: "seen while waiting",
				kind: "note",
				status: "open",
				createdBy: "agent",
				createdAt: now,
			},
			{
				workspaceId: "ws-hub",
				text: "Keep the old endpoint",
				details: null,
				kind: "context",
				status: "kept",
				createdBy: "user",
				createdAt: now,
			},
			{
				workspaceId: "ws-hub",
				text: "Dropped one",
				details: null,
				kind: "note",
				status: "dropped",
				createdBy: "user",
				createdAt: now,
			},
		],
		tasks: [
			{
				workspaceId: "ws-hub",
				terminalId: "t-old",
				liveTerminalId: "t-2",
				title: "Wait for CI",
				status: "running",
				silence: null,
				updatedAt: now,
				link: "https://github.com/x/y/pull/1",
			},
		],
		labels: {
			labels: [{ id: "l-wait", name: "Waiting" }],
			assignments: { "ws-hub": ["l-wait", "l-unknown"] },
		},
		unavailable: [],
		ignoreWorkspaceIds: new Set(["ws-observer"]),
		...overrides,
	};
}

describe("buildDigest", () => {
	test("summarizes each conversation with what it owes and waits for", () => {
		const digest = buildDigest(input());
		expect(digest.workspaces.map((workspace) => workspace.id)).toEqual([
			"ws-hub",
		]);
		const [hub] = digest.workspaces;
		expect(hub?.labels).toEqual(["Waiting"]);
		expect(hub?.notes).toEqual([
			{
				text: "Keep the old endpoint",
				kind: "context",
				status: "kept",
				by: "user",
			},
		]);
		const byId = new Map(
			hub?.conversations.map((conversation) => [
				conversation.terminalId,
				conversation,
			]),
		);
		expect([...byId.keys()].sort()).toEqual(["t-1", "t-2"]);
		expect(byId.get("t-1")).toMatchObject({
			title: "Fix the LIMS sync",
			state: "idle",
			quietMinutes: 30 * 60,
			ageHours: 48,
			subagents: 1,
			openTodos: [{ text: "Answer Victor", by: "user", priority: "high" }],
			openReports: [],
		});
		expect(byId.get("t-2")).toMatchObject({
			state: "working",
			openReports: [{ kind: "decision", summary: "Which cache?", ageHours: 5 }],
			tracked: [{ title: "Wait for CI", silence: null }],
		});
	});

	test("counts states and lifts Superset ideas out of the notes", () => {
		const digest = buildDigest(input());
		expect(digest.totals).toEqual({
			workspaces: 1,
			conversations: 2,
			working: 1,
			blocked: 0,
			idle: 1,
			idleOverADay: 1,
			openReports: 1,
			openUserTodos: 1,
		});
		expect(digest.supersetIdeas).toEqual([
			{
				workspace: "lims-fix",
				text: "Superset idea: show CI in the Office",
				details: "seen while waiting",
			},
		]);
	});

	test("says which sources the host could not give", () => {
		const digest = buildDigest(
			input({ todos: null, notes: null, unavailable: ["todos", "notes"] }),
		);
		expect(digest.unavailable).toEqual(["todos", "notes"]);
		expect(digest.supersetIdeas).toEqual([]);
		expect(digest.totals.openUserTodos).toBe(0);
	});
});

describe("readSynthesis", () => {
	test("reads a headline and findings", () => {
		const synthesis = readSynthesis("x.json", () =>
			JSON.stringify({ headline: "Calm day", findings: [] }),
		);
		expect(synthesis.headline).toBe("Calm day");
	});

	test("rejects broken JSON and a missing headline", () => {
		expect(() => readSynthesis("x.json", () => "{")).toThrow();
		expect(() =>
			readSynthesis("x.json", () => JSON.stringify({ findings: [] })),
		).toThrow();
	});
});
