import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { EventEmitter } from "node:events";
import { startSandboxAgentStatusReporter } from "./sandbox-agent-status";

type Report = { status: string | null; at: number };

class FakeStore extends EventEmitter {
	lastEventType: string | null = null;
	list() {
		return this.lastEventType ? [{ lastEventType: this.lastEventType }] : [];
	}
	set(eventType: string | null) {
		this.lastEventType = eventType;
		this.emit("change");
	}
}

const timing = {
	settleMs: 1,
	minIntervalMs: 1,
	workingHeartbeatMs: 20,
	retryBaseMs: 1,
	retryMaxMs: 4,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let reports: Report[];
let failNext: number;
let fetchSpy: ReturnType<typeof spyOn>;
let stop: () => void;
let store: FakeStore;

beforeEach(() => {
	reports = [];
	failNext = 0;
	store = new FakeStore();
	fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
		_url: string,
		init: RequestInit,
	) => {
		if (failNext > 0) {
			failNext -= 1;
			return new Response(null, { status: 503 });
		}
		reports.push(JSON.parse(init.body as string));
		return new Response(null, { status: 200 });
	}) as never);
	stop = startSandboxAgentStatusReporter({
		apiUrl: "https://api.test",
		workspaceId: "ws",
		hostSecret: "secret",
		store: store as never,
		timing,
	});
});

afterEach(() => {
	stop();
	fetchSpy.mockRestore();
});

describe("startSandboxAgentStatusReporter", () => {
	test("repeats working with its original timestamp, and stops once it leaves working", async () => {
		store.set("Start");
		await sleep(70);
		const working = reports.filter((report) => report.status === "working");
		expect(working.length).toBeGreaterThanOrEqual(2);
		expect(new Set(working.map((report) => report.at)).size).toBe(1);

		store.set("Stop");
		await sleep(10);
		const count = reports.length;
		expect(reports.at(-1)?.status).toBe("review");
		await sleep(50);
		expect(reports.length).toBe(count);
	});

	test("retries a failed report until it lands", async () => {
		await sleep(5);
		failNext = 3;
		store.set("PermissionRequest");
		await sleep(40);
		expect(reports.at(-1)?.status).toBe("permission");
		expect(fetchSpy.mock.calls.length).toBe(reports.length + 3);
	});
});
