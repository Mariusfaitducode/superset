import { describe, expect, test } from "bun:test";
import {
	groupFindings,
	latestSynthesis,
	OBSERVER_STALL_MS,
	type ObserverFinding,
	type ObserverRun,
	observerStatus,
} from "./observerStatus";

const now = 10 * OBSERVER_STALL_MS;

function run(overrides: Partial<ObserverRun> = {}): ObserverRun {
	return {
		id: "run",
		workspaceId: "ws",
		terminalId: "term",
		status: "done",
		startedAt: now - 1_000,
		finishedAt: now - 500,
		synthesis: { headline: "Calm", findings: [], file: null },
		...overrides,
	};
}

function finding(overrides: Partial<ObserverFinding>): ObserverFinding {
	return {
		mission: "work",
		priority: "normal",
		title: "x",
		detail: null,
		link: null,
		workspaceId: null,
		terminalId: null,
		...overrides,
	};
}

describe("observerStatus", () => {
	test("never ran", () => {
		expect(observerStatus([], now, null)).toEqual({ kind: "never" });
	});

	test("starting until a run newer than the request shows up", () => {
		const old = run({ startedAt: now - 5_000 });
		expect(observerStatus([old], now, now - 2_000).kind).toBe("starting");
		const fresh = run({ status: "running", startedAt: now - 1_000 });
		expect(observerStatus([fresh], now, now - 2_000).kind).toBe("running");
	});

	test("a request that never started a run stops showing after a while", () => {
		expect(observerStatus([], now, now - OBSERVER_STALL_MS - 1).kind).toBe(
			"never",
		);
	});

	test("a run that never published reads as stalled", () => {
		const stuck = run({
			status: "running",
			startedAt: now - OBSERVER_STALL_MS - 1,
			synthesis: null,
		});
		expect(observerStatus([stuck], now, null).kind).toBe("stalled");
	});

	test("idle after a published or abandoned run", () => {
		expect(observerStatus([run()], now, null).kind).toBe("idle");
		expect(observerStatus([run({ status: "abandoned" })], now, null).kind).toBe(
			"idle",
		);
	});
});

describe("latestSynthesis", () => {
	test("skips runs that have not published", () => {
		const published = run({ id: "published" });
		const running = run({ id: "running", status: "running", synthesis: null });
		expect(latestSynthesis([running, published])?.id).toBe("published");
		expect(latestSynthesis([running])).toBeNull();
	});
});

describe("groupFindings", () => {
	test("orders missions and puts high priority first", () => {
		const groups = groupFindings([
			finding({ mission: "superset", title: "idea" }),
			finding({ mission: "work", title: "later" }),
			finding({ mission: "work", title: "today", priority: "high" }),
		]);
		expect(groups.map((group) => group.mission)).toEqual(["work", "superset"]);
		expect(groups[0]?.findings.map((item) => item.title)).toEqual([
			"today",
			"later",
		]);
	});
});
