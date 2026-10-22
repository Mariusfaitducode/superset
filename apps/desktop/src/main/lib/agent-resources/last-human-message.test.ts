import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	claudeProjectDirName,
	isHumanEntry,
	readLastHumanMessageAt,
} from "./last-human-message";

function line(entry: Record<string, unknown>): string {
	return `${JSON.stringify(entry)}\n`;
}

const human = (timestamp: string, content: unknown = "hello") => ({
	type: "user",
	timestamp,
	message: { role: "user", content },
});

describe("isHumanEntry", () => {
	it("trusts origin.kind when the CLI writes it", () => {
		expect(isHumanEntry({ type: "user", origin: { kind: "human" } })).toBe(
			true,
		);
		expect(
			isHumanEntry({
				type: "user",
				origin: { kind: "task-notification" },
				message: { content: "looks human" },
			}),
		).toBe(false);
	});

	it("skips tool results, meta, sidechain and system-injected text", () => {
		expect(
			isHumanEntry({
				type: "user",
				message: { content: [{ type: "tool_result", content: "ok" }] },
			}),
		).toBe(false);
		expect(isHumanEntry({ ...human("t"), isMeta: true })).toBe(false);
		expect(isHumanEntry({ ...human("t"), isSidechain: true })).toBe(false);
		for (const content of [
			"<task-notification>\n<task-id>x</task-id>",
			"<command-name>/clear</command-name>",
			"<local-command-stdout>done</local-command-stdout>",
		]) {
			expect(isHumanEntry(human("t", content))).toBe(false);
		}
	});

	it("accepts typed text, as a string or as text parts", () => {
		expect(isHumanEntry(human("t", "fix the bug"))).toBe(true);
		expect(
			isHumanEntry(human("t", [{ type: "text", text: "look at this" }])),
		).toBe(true);
	});
});

describe("readLastHumanMessageAt", () => {
	let dir: string;
	let file: string;

	beforeEach(() => {
		dir = mkdtempSync(path.join(os.tmpdir(), "last-human-"));
		file = path.join(dir, "session.jsonl");
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("returns the last human message, ignoring later agent traffic", async () => {
		writeFileSync(
			file,
			line(human("2026-10-20T10:00:00.000Z")) +
				line(human("2026-10-20T11:00:00.000Z")) +
				line({ type: "assistant", message: { content: "done" } }) +
				line({
					type: "user",
					timestamp: "2026-10-20T12:00:00.000Z",
					message: { content: [{ type: "tool_result", content: "x" }] },
				}),
		);
		expect(await readLastHumanMessageAt(file)).toBe(
			Date.parse("2026-10-20T11:00:00.000Z"),
		);
	});

	it("finds a message far behind a large tail of agent output", async () => {
		const filler = line({
			type: "assistant",
			message: { content: "x".repeat(10_000) },
		}).repeat(100);
		writeFileSync(file, line(human("2026-10-19T08:00:00.000Z")) + filler);
		expect(await readLastHumanMessageAt(file)).toBe(
			Date.parse("2026-10-19T08:00:00.000Z"),
		);
	});

	it("picks up a message appended after the previous read", async () => {
		writeFileSync(file, line(human("2026-10-20T10:00:00.000Z")));
		expect(await readLastHumanMessageAt(file)).toBe(
			Date.parse("2026-10-20T10:00:00.000Z"),
		);
		// Ensure a new mtime on file systems with coarse timestamps.
		await new Promise((resolve) => setTimeout(resolve, 20));
		appendFileSync(
			file,
			line({ type: "assistant", message: { content: "ok" } }) +
				line(human("2026-10-21T09:00:00.000Z")),
		);
		expect(await readLastHumanMessageAt(file)).toBe(
			Date.parse("2026-10-21T09:00:00.000Z"),
		);
	});

	it("returns null for a missing file", async () => {
		expect(await readLastHumanMessageAt(path.join(dir, "nope.jsonl"))).toBe(
			null,
		);
	});
});

describe("claudeProjectDirName", () => {
	it("replaces every non-alphanumeric character with a dash", () => {
		expect(
			claudeProjectDirName("/Users/marius/.superset/worktrees/hub/my_branch"),
		).toBe("-Users-marius--superset-worktrees-hub-my-branch");
	});
});
