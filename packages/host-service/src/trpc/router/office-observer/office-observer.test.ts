import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostServiceContext } from "../../../types";
import { officeObserverRouter } from "./office-observer";

const home = mkdtempSync(join(tmpdir(), "observer-router-"));
process.env.SUPERSET_HOME_DIR = home;

afterAll(() => {
	rmSync(home, { recursive: true, force: true });
});

const changed: string[] = [];
const caller = officeObserverRouter.createCaller({
	isAuthenticated: true,
	eventBus: {
		broadcastHostStoreChanged: (store: string) => changed.push(store),
	},
} as unknown as HostServiceContext);

const where = { workspaceId: "ws", terminalId: "term" };

describe("officeObserverRouter", () => {
	test("a run begins, publishes and tells clients", async () => {
		changed.length = 0;
		await caller.begin(where);
		await caller.publish({
			...where,
			headline: "Three agents idle",
			findings: [
				{
					mission: "work",
					priority: "high",
					title: "PR waits for your review",
					link: "https://github.com/org/repo/pull/1",
				},
			],
		});
		const { runs } = await caller.get();
		expect(runs).toHaveLength(1);
		expect(runs[0]?.status).toBe("done");
		expect(runs[0]?.synthesis?.findings[0]?.priority).toBe("high");
		expect(changed).toEqual(["office-observer", "office-observer"]);
	});

	test("rejects an unknown mission and a non-web link", async () => {
		await expect(
			caller.publish({
				...where,
				headline: "x",
				findings: [{ mission: "other" as "work", title: "y" }],
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			caller.publish({
				...where,
				headline: "x",
				findings: [{ mission: "work", title: "y", link: "file:///etc/passwd" }],
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
