import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostServiceContext } from "../../../types";
import { agentReportsRouter } from "./agent-reports";

const home = mkdtempSync(join(tmpdir(), "reports-router-"));
process.env.SUPERSET_HOME_DIR = home;

afterAll(() => {
	rmSync(home, { recursive: true, force: true });
});

const changed: string[] = [];
const caller = agentReportsRouter.createCaller({
	isAuthenticated: true,
	eventBus: {
		broadcastHostStoreChanged: (store: string) => changed.push(store),
	},
} as unknown as HostServiceContext);

const where = { workspaceId: "ws", terminalId: "term" };

describe("agentReportsRouter", () => {
	test("creates, lists open reports and tells clients", async () => {
		changed.length = 0;
		const report = await caller.create({
			...where,
			actor: "agent",
			kind: "done",
			summary: "PR ready",
			links: ["https://github.com/org/repo/pull/1"],
		});
		expect(report.createdBy).toBe("agent");
		expect(await caller.list({ status: "open" })).toHaveLength(1);
		expect(changed).toEqual(["agent-reports"]);
	});

	test("answers FORBIDDEN when an agent answers, CONFLICT the second time", async () => {
		const report = await caller.create({
			...where,
			actor: "agent",
			kind: "decision",
			summary: "A or B?",
			options: ["A", "B"],
		});
		await expect(
			caller.answer({ actor: "agent", id: report.id, answer: "A" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await caller.answer({ id: report.id, answer: "A" });
		await expect(
			caller.answer({ id: report.id, answer: "B" }),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	test("accepts only http and https links", async () => {
		await expect(
			caller.create({
				...where,
				kind: "done",
				summary: "x",
				links: ["javascript:alert(1)"],
			}),
		).rejects.toThrow();
	});

	test("answers NOT_FOUND for an unknown id", async () => {
		await expect(caller.dismiss({ id: "missing" })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});
