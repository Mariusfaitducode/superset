import { describe, expect, test } from "bun:test";
import { type Report, readDraft, resolveReportId } from "./reports";

const report = (id: string) => ({ id }) as Report;

describe("reports CLI helpers", () => {
	test("reads a draft's text from its file", () => {
		expect(
			readDraft(
				"draft",
				{ draftFile: "reply.md", target: "slack" },
				() => "Hi Paul",
			),
		).toEqual({ text: "Hi Paul", target: "slack" });
	});

	test("a draft needs a file and a target, other kinds take neither", () => {
		expect(() => readDraft("draft", { target: "slack" })).toThrow();
		expect(() => readDraft("draft", { draftFile: "x" })).toThrow();
		expect(() =>
			readDraft("draft", { draftFile: "x", target: "slack" }, () => " "),
		).toThrow();
		expect(() => readDraft("done", { draftFile: "x" })).toThrow();
		expect(readDraft("done", {})).toBeUndefined();
	});

	test("resolves an unambiguous short id", () => {
		const reports = [report("abc123"), report("abd456")];
		expect(resolveReportId("abc", reports)).toBe("abc123");
		expect(() => resolveReportId("ab", reports)).toThrow();
		expect(() => resolveReportId("zz", reports)).toThrow();
	});
});
