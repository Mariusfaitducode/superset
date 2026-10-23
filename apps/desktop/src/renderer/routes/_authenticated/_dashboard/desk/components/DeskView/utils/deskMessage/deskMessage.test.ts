import { describe, expect, test } from "bun:test";
import type { DeskItem } from "renderer/routes/_authenticated/_dashboard/hooks/useDeskQueue";
import { deskMessage } from "./deskMessage";

const report = {
	source: "report",
	report: { summary: "Reply to Paul" },
} as DeskItem;

describe("deskMessage", () => {
	test("names the report it answers", () => {
		expect(deskMessage(report, { type: "answer", text: "Option B" })).toBe(
			'From the Desk, answer to "Reply to Paul": Option B',
		);
	});

	test("approves a draft as is, or sends the edited text", () => {
		expect(deskMessage(report, { type: "approve", editedText: null })).toBe(
			'From the Desk: draft "Reply to Paul" approved. Send exactly this text.',
		);
		expect(
			deskMessage(report, { type: "approve", editedText: "Hi Paul" }),
		).toContain("approved with edits. Send exactly this text:\n\nHi Paul");
	});

	test("answers an agent's to-do by its text", () => {
		const todo = { source: "todo", todo: { text: "Check the PR" } } as DeskItem;
		expect(deskMessage(todo, { type: "answer", text: "ok" })).toBe(
			'From the Desk, about your to-do "Check the PR": ok',
		);
	});
});
