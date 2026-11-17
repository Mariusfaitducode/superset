import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_RUNS, OfficeObserverStore } from "./store";

let dir: string;
let filePath: string;
let clock: number;
let store: OfficeObserverStore;

const run1 = { workspaceId: "ws-1", terminalId: "term-1" };
const run2 = { workspaceId: "ws-2", terminalId: "term-2" };

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "observer-"));
	filePath = join(dir, "state", "office-observer.json");
	clock = 1_000;
	store = new OfficeObserverStore(filePath, () => clock++);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("OfficeObserverStore", () => {
	test("starts empty, with no agent chosen", () => {
		expect(store.get()).toEqual({ config: { agent: null }, runs: [] });
	});

	test("a published synthesis closes the conversation's run", () => {
		const started = store.begin(run1);
		const done = store.publish({
			...run1,
			headline: "  Two agents idle since yesterday ",
			findings: [
				{ mission: "efficiency", title: " Close hub-old ", detail: " " },
			],
			file: "/tmp/2026-11-17.md",
		});
		expect(done).toMatchObject({
			id: started.id,
			status: "done",
			startedAt: started.startedAt,
			synthesis: {
				headline: "Two agents idle since yesterday",
				file: "/tmp/2026-11-17.md",
				findings: [
					{
						mission: "efficiency",
						priority: "normal",
						title: "Close hub-old",
						detail: null,
						link: null,
						workspaceId: null,
						terminalId: null,
					},
				],
			},
		});
		expect(done.finishedAt).toBeGreaterThan(started.startedAt);
		const onDisk = new OfficeObserverStore(filePath).get();
		expect(onDisk.runs).toHaveLength(1);
		expect(onDisk.runs[0]?.status).toBe("done");
	});

	test("a new run abandons the one that never published", () => {
		store.begin(run1);
		store.begin(run2);
		const [latest, previous] = store.get().runs;
		expect(latest).toMatchObject({ ...run2, status: "running" });
		expect(previous).toMatchObject({ ...run1, status: "abandoned" });
		expect(previous?.finishedAt).not.toBeNull();
	});

	test("publishing without begin still records the run", () => {
		const done = store.publish({
			...run2,
			headline: "All quiet",
			findings: [],
		});
		expect(store.get().runs).toEqual([done]);
		expect(done.startedAt).toBe(done.finishedAt ?? -1);
	});

	test("rejects an empty headline", () => {
		expect(() =>
			store.publish({ ...run1, headline: "  ", findings: [] }),
		).toThrow();
	});

	test("keeps the newest runs only", () => {
		for (let index = 0; index < MAX_RUNS + 3; index++) {
			store.publish({
				workspaceId: "ws",
				terminalId: `term-${index}`,
				headline: `Run ${index}`,
				findings: [],
			});
		}
		const file = JSON.parse(readFileSync(filePath, "utf8"));
		expect(file.runs).toHaveLength(MAX_RUNS);
		expect(file.runs[0].synthesis.headline).toBe(`Run ${MAX_RUNS + 2}`);
		expect(store.get(2).runs).toHaveLength(2);
	});

	test("stores the agent Run now starts, blank meaning the default", () => {
		expect(store.setConfig({ agent: " claude " })).toEqual({ agent: "claude" });
		expect(store.setConfig({ agent: "  " })).toEqual({ agent: null });
	});
});
