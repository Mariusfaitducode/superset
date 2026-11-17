import { describe, expect, test } from "bun:test";
import {
	type FleetAgent,
	fleetGroupOf,
	modelLabel,
	summarizeFleet,
} from "./agent-fleet-stats";
import { WORK_STATES } from "./work-state";

const agent = (input: Partial<FleetAgent>): FleetAgent => ({
	state: "resume",
	hostId: "mac",
	model: null,
	subagents: 0,
	workflowAgents: 0,
	usage: null,
	...input,
});

describe("modelLabel", () => {
	test.each([
		["claude-opus-5-5", "Opus 5.5"],
		["claude-opus-4-1-20250805", "Opus 4.1"],
		["claude-sonnet-4-20250514", "Sonnet 4"],
		["claude-haiku-4-5-20251001", "Haiku 4.5"],
		["claude-sonnet-4-5[1m]", "Sonnet 4.5"],
		["claude-3-5-sonnet-20241022", "Sonnet 3.5"],
		["claude-3-opus-20240229", "Opus 3"],
		["opus", "Opus"],
		["claude-fable-1", "Fable 1"],
		["gpt-5-codex", "gpt-5-codex"],
	])("%s is %s", (model, label) => {
		expect(modelLabel(model)).toBe(label);
	});
});

describe("fleetGroupOf", () => {
	test("puts every work state in exactly one group", () => {
		expect(WORK_STATES.map(fleetGroupOf)).toEqual([
			"waiting",
			"toCheck",
			"working",
			"toResume",
			"toResume",
			"toClose",
		]);
	});
});

describe("summarizeFleet", () => {
	test("counts each agent once, in its state's group", () => {
		const stats = summarizeFleet([
			agent({ state: "working" }),
			agent({ state: "working" }),
			agent({ state: "waiting" }),
			agent({ state: "todos" }),
			agent({ state: "resume" }),
			agent({ state: "check" }),
			agent({ state: "done" }),
		]);
		expect(stats.open).toBe(7);
		expect(stats.groups).toEqual({
			working: 2,
			waiting: 1,
			toResume: 2,
			toCheck: 1,
			toClose: 1,
		});
		const grouped = Object.values(stats.groups).reduce((a, b) => a + b, 0);
		expect(grouped).toBe(stats.open);
	});

	test("splits by host, busiest first", () => {
		const stats = summarizeFleet([
			agent({ hostId: "tour", state: "working" }),
			agent({ hostId: "mac", state: "waiting" }),
			agent({ hostId: "mac" }),
		]);
		expect(stats.hosts).toEqual([
			{ hostId: "mac", open: 2, working: 0, waiting: 1 },
			{ hostId: "tour", open: 1, working: 1, waiting: 0 },
		]);
	});

	test("groups models by label and keeps unknown ones apart", () => {
		const stats = summarizeFleet([
			agent({ model: "claude-opus-5-5", state: "working" }),
			agent({ model: "claude-opus-5-5[1m]" }),
			agent({ model: "claude-sonnet-4-5-20250929" }),
			agent({ model: null }),
		]);
		expect(stats.models).toEqual([
			{ model: "Opus 5.5", open: 2, working: 1, waiting: 0 },
			{ model: "Sonnet 4.5", open: 1, working: 0, waiting: 0 },
		]);
		expect(stats.unknownModel).toBe(1);
	});

	test("counts children and the agents that run them", () => {
		const stats = summarizeFleet([
			agent({ subagents: 2 }),
			agent({ workflowAgents: 3 }),
			agent({}),
		]);
		expect(stats.subagents).toBe(2);
		expect(stats.workflowAgents).toBe(3);
		expect(stats.withChildren).toBe(2);
	});

	test("sums known usage and says how many agents it covers", () => {
		const usage = {
			inputTokens: 10,
			cachedInputTokens: 100,
			outputTokens: 5,
			costUsd: 1.5,
		};
		const stats = summarizeFleet([
			agent({ usage }),
			agent({ usage: { ...usage, costUsd: null } }),
			agent({ usage: null }),
		]);
		expect(stats.usage).toEqual({
			inputTokens: 20,
			cachedInputTokens: 200,
			outputTokens: 10,
			costUsd: 1.5,
			agents: 2,
			unpriced: 1,
		});
	});

	test("has no cost when nothing is priced", () => {
		expect(summarizeFleet([]).usage.costUsd).toBeNull();
	});
});
