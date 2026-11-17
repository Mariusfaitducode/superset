import { describe, expect, test } from "bun:test";
import {
	buildDigest,
	type DigestInput,
	fleetMembers,
	formatFleet,
	summarizeHosts,
} from "./digest";
import { readSynthesis } from "./synthesis";

const HOUR = 3_600_000;
const now = 100 * HOUR;

function input(overrides: Partial<DigestInput> = {}): DigestInput {
	return {
		now,
		hostId: "mac",
		marks: [],
		sessionStats: [],
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

describe("work states and global numbers", () => {
	const MINUTE = 60_000;
	const agent = (
		terminalId: string,
		lastEventType: string,
		ago: number,
		extra: Partial<DigestInput["agents"][number]> = {},
	): DigestInput["agents"][number] => ({
		terminalId,
		workspaceId: "ws-a",
		agentId: "claude",
		lastEventType,
		lastEventAt: now - ago,
		startedAt: now - 5 * HOUR,
		...extra,
	});
	const usage = {
		inputTokens: 100,
		cachedInputTokens: 1_000,
		outputTokens: 50,
	};
	const states = (): DigestInput =>
		input({
			workspaces: [{ id: "ws-a", name: "a", branch: null, projectName: null }],
			terminals: [],
			agents: [
				agent("todos", "Stop", 2 * HOUR),
				agent("done", "Stop", HOUR),
				agent("pinned", "Stop", HOUR),
				agent("silent", "Start", 2 * HOUR),
				agent("asks", "PermissionRequest", MINUTE),
				agent("busy", "Start", MINUTE, {
					subagents: [{ workflow: { runId: "r" } }, {}],
				}),
				agent("closed", "Stop", HOUR, { endedAt: now }),
			],
			todos: [
				{
					workspaceId: "ws-a",
					terminalId: "todos",
					text: "Pick up",
					done: false,
					author: "agent",
					priority: "normal",
					kind: "task",
					dueOn: null,
				},
			],
			reports: [
				{
					workspaceId: "ws-a",
					terminalId: "done",
					kind: "done",
					summary: "Shipped",
					status: "answered",
					createdAt: now - HOUR - MINUTE,
				},
			],
			marks: [
				{ terminalId: "pinned", state: "resume", setBy: "user", setAt: now },
			],
			sessionStats: [
				{
					terminalId: "busy",
					stats: { model: "claude-opus-5-5", ...usage, costUsd: 2 },
				},
				{
					terminalId: "todos",
					stats: { model: "claude-sonnet-4-5", ...usage, costUsd: null },
				},
				{ terminalId: "asks", stats: null },
			],
			notes: [],
			tasks: [],
			ignoreWorkspaceIds: new Set(),
		});

	test("derives each conversation's state like the Office, read or unread", () => {
		const digest = buildDigest(states());
		const work = new Map(
			digest.workspaces[0]?.conversations.map((conversation) => [
				conversation.terminalId,
				conversation.work,
			]),
		);
		expect(work.get("todos")).toEqual({
			state: "todos",
			cause: "todos",
			pinned: false,
			ifUnread: "waiting",
		});
		expect(work.get("done")).toMatchObject({
			state: "done",
			ifUnread: "waiting",
		});
		// A pin holds whether the reply was read or not.
		expect(work.get("pinned")).toEqual({
			state: "resume",
			cause: "pinned",
			pinned: true,
			ifUnread: null,
		});
		expect(work.get("silent")).toMatchObject({ state: "check" });
		expect(work.get("asks")).toMatchObject({ state: "waiting" });
		expect(work.get("busy")).toMatchObject({ state: "working" });
	});

	test("gives the Office strip's numbers", () => {
		const { fleet } = buildDigest(states());
		expect(fleet.open).toBe(6);
		expect(fleet.groups).toEqual({
			working: 1,
			waiting: 1,
			toResume: 2,
			toCheck: 1,
			toClose: 1,
		});
		expect(fleet.readUnknown).toBe(2);
		expect(fleet.subagents).toBe(1);
		expect(fleet.workflowAgents).toBe(1);
		expect(fleet.models.map((model) => model.model)).toEqual([
			"Opus 5.5",
			"Sonnet 4.5",
		]);
		expect(fleet.unknownModel).toBe(4);
		expect(fleet.usage).toMatchObject({ agents: 2, costUsd: 2, unpriced: 1 });
		expect(fleet.hosts).toEqual([
			{ hostId: "mac", open: 6, working: 1, waiting: 1 },
		]);
		expect(formatFleet(fleet)[0]).toContain("6 open agents: 1 working");
	});

	test("says models are unavailable on a host too old to give them", () => {
		const { fleet } = buildDigest({ ...states(), sessionStats: null });
		expect(fleet.modelsAvailable).toBe(false);
		expect(formatFleet(fleet).at(-1)).toBe(
			"Models and tokens: unavailable on this host.",
		);
	});

	test("adds hosts up into one set of numbers", () => {
		const mac = states();
		const tour = { ...states(), hostId: "tour", sessionStats: null };
		const fleet = summarizeHosts(
			[mac, tour].map((host) => ({
				members: fleetMembers(host),
				modelsAvailable: host.sessionStats !== null,
			})),
		);
		expect(fleet.open).toBe(12);
		expect(fleet.hosts.map((host) => [host.hostId, host.open])).toEqual([
			["mac", 6],
			["tour", 6],
		]);
		expect(fleet.modelsAvailable).toBe(true);
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
