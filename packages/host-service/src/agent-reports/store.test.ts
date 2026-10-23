import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	AgentReportStore,
	MAX_REPORTS_PER_CONVERSATION,
	ReportClosedError,
	ReportPermissionError,
} from "./store";

let dir: string;
let filePath: string;
let clock: number;
let store: AgentReportStore;

const where = { workspaceId: "ws-1", terminalId: "term-1" };

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "reports-"));
	filePath = join(dir, "state", "agent-reports.json");
	clock = 1_000;
	store = new AgentReportStore(filePath, () => clock++);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("AgentReportStore", () => {
	test("creates an open report and keeps it on disk", () => {
		const report = store.create({
			...where,
			actor: "agent",
			kind: "decision",
			summary: "  Which cache? ",
			options: ["Redis", "In memory"],
		});
		expect(report).toMatchObject({
			summary: "Which cache?",
			status: "open",
			createdBy: "agent",
			options: ["Redis", "In memory"],
			answer: null,
		});
		const file = JSON.parse(readFileSync(filePath, "utf8"));
		expect(file.reports).toHaveLength(1);
		expect(new AgentReportStore(filePath).list()).toHaveLength(1);
	});

	test("a new report closes the open one of the same kind and conversation", () => {
		const first = store.create({
			...where,
			actor: "agent",
			kind: "decision",
			summary: "A or B?",
		});
		const done = store.create({
			...where,
			actor: "agent",
			kind: "done",
			summary: "PR ready",
		});
		const second = store.create({
			...where,
			actor: "agent",
			kind: "decision",
			summary: "A or B, now with C?",
		});
		expect(store.list({ status: "open" }).map((report) => report.id)).toEqual([
			done.id,
			second.id,
		]);
		expect(store.list().find((report) => report.id === first.id)).toMatchObject(
			{ status: "dismissed", supersededBy: second.id },
		);
	});

	test("refuses a draft without its text", () => {
		expect(() =>
			store.create({ ...where, actor: "agent", kind: "draft", summary: "x" }),
		).toThrow();
	});

	test("only the user answers, and only once", () => {
		const report = store.create({
			...where,
			actor: "agent",
			kind: "blocked",
			summary: "Need the AWS profile",
		});
		expect(() => store.answer("agent", report.id, "ok")).toThrow(
			ReportPermissionError,
		);
		const answered = store.answer("user", report.id, " Done, try again ");
		expect(answered).toMatchObject({
			status: "answered",
			answer: "Done, try again",
		});
		expect(answered.answeredAt).not.toBeNull();
		expect(() => store.answer("user", report.id, "again")).toThrow(
			ReportClosedError,
		);
	});

	test("agents withdraw their own reports, not the user's", () => {
		const mine = store.create({
			...where,
			actor: "agent",
			kind: "done",
			summary: "x",
		});
		const users = store.create({
			...where,
			actor: "user",
			kind: "decision",
			summary: "y",
		});
		expect(store.dismiss("agent", mine.id).status).toBe("dismissed");
		expect(() => store.dismiss("agent", users.id)).toThrow(
			ReportPermissionError,
		);
	});

	test("drops closed history before open reports past the cap", () => {
		const open = store.create({
			...where,
			actor: "agent",
			kind: "blocked",
			summary: "still open",
		});
		for (let index = 0; index < MAX_REPORTS_PER_CONVERSATION + 5; index++) {
			store.create({
				...where,
				actor: "agent",
				kind: "done",
				summary: `done ${index}`,
			});
		}
		const reports = store.list();
		expect(reports).toHaveLength(MAX_REPORTS_PER_CONVERSATION);
		expect(reports.some((report) => report.id === open.id)).toBe(true);
	});
});
