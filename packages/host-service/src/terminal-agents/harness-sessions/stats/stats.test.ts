import { afterEach, describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptySessionStats, sessionStatsReader, toSessionStats } from "./index";
import { readCompleteLines } from "./read";
import type { SessionStatsAgent } from "./types";

const created: string[] = [];
afterEach(() => {
	for (const dir of created.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function statsOf(agent: SessionStatsAgent, lines: object[]) {
	const reader = sessionStatsReader(emptySessionStats(agent));
	for (const line of lines) reader.onLine(JSON.stringify(line));
	return toSessionStats(reader.finish());
}

function claudeAssistant(
	id: string,
	usage: Record<string, number>,
	extra: object = {},
) {
	return {
		type: "assistant",
		requestId: `req-${id}`,
		timestamp: "2026-10-20T10:05:00.000Z",
		message: { id, model: "claude-sonnet-4-5", usage },
		...extra,
	};
}

describe("Claude session stats", () => {
	test("counts each request once and reads context from the latest one", () => {
		const stats = statsOf("claude", [
			{
				type: "user",
				timestamp: "2026-10-20T10:00:00.000Z",
				message: { content: "fix the bug" },
			},
			claudeAssistant("m1", { input_tokens: 10, output_tokens: 5 }),
			claudeAssistant("m1", {
				input_tokens: 10,
				cache_read_input_tokens: 1_000,
				cache_creation_input_tokens: 200,
				output_tokens: 40,
			}),
			{
				type: "user",
				message: { content: [{ type: "tool_result", content: "ok" }] },
			},
			claudeAssistant(
				"side",
				{ input_tokens: 9_999, output_tokens: 9_999 },
				{ isSidechain: true },
			),
			claudeAssistant("m2", {
				input_tokens: 3,
				cache_read_input_tokens: 1_400,
				output_tokens: 7,
			}),
			claudeAssistant("m1", { input_tokens: 10, output_tokens: 40 }),
		]);

		expect(stats).toMatchObject({
			agent: "claude",
			model: "claude-sonnet-4-5",
			turns: 1,
			contextUsed: 1_403,
			contextMax: 200_000,
			inputTokens: 213,
			cachedInputTokens: 2_400,
			outputTokens: 47,
			startedAt: Date.parse("2026-10-20T10:00:00.000Z"),
			lastEventAt: Date.parse("2026-10-20T10:05:00.000Z"),
		});
		expect(stats?.costUsd).toBeGreaterThan(0);
	});

	test("reads a request past 200k tokens as a 1M window", () => {
		const stats = statsOf("claude", [
			claudeAssistant("m1", {
				input_tokens: 1,
				cache_read_input_tokens: 250_000,
				output_tokens: 1,
			}),
		]);
		expect(stats?.contextMax).toBe(1_000_000);
	});

	test("has no stats before the first request", () => {
		expect(
			statsOf("claude", [{ type: "user", message: { content: "hello" } }]),
		).toBeNull();
	});
});

describe("Codex session stats", () => {
	test("reads the reported window and cumulative totals", () => {
		const tokenCount = (last: object, total: object) => ({
			type: "event_msg",
			timestamp: "2026-10-20T11:00:30.000Z",
			payload: {
				type: "token_count",
				info: {
					last_token_usage: last,
					total_token_usage: total,
					model_context_window: 258_400,
				},
			},
		});
		const stats = statsOf("codex", [
			{
				type: "turn_context",
				timestamp: "2026-10-20T11:00:00.000Z",
				payload: { model: "gpt-5-codex" },
			},
			{
				type: "event_msg",
				payload: { type: "user_message", message: "add tests" },
			},
			tokenCount(
				{
					input_tokens: 1_000,
					cached_input_tokens: 400,
					output_tokens: 50,
					total_tokens: 1_050,
				},
				{ input_tokens: 1_000, cached_input_tokens: 400, output_tokens: 50 },
			),
			tokenCount(
				{
					input_tokens: 2_000,
					cached_input_tokens: 1_500,
					output_tokens: 80,
					total_tokens: 2_080,
				},
				{ input_tokens: 3_000, cached_input_tokens: 1_900, output_tokens: 130 },
			),
		]);

		expect(stats).toMatchObject({
			agent: "codex",
			model: "gpt-5-codex",
			turns: 1,
			contextUsed: 2_080,
			contextMax: 258_400,
			inputTokens: 1_100,
			cachedInputTokens: 1_900,
			outputTokens: 130,
		});
		expect(stats?.costUsd).toBeGreaterThan(0);
	});
});

describe("readCompleteLines", () => {
	test("leaves a line still being written for the next read", async () => {
		const dir = mkdtempSync(join(tmpdir(), "session-stats-"));
		created.push(dir);
		const path = join(dir, "session.jsonl");
		writeFileSync(path, "first\r\nsecond\nthi");
		const seen: string[] = [];

		const offset = await readCompleteLines(path, 0, 17, (line) =>
			seen.push(line),
		);
		appendFileSync(path, "rd\n");
		await readCompleteLines(path, offset, 20, (line) => seen.push(line));

		expect(offset).toBe(14);
		expect(seen).toEqual(["first", "second", "third"]);
	});
});
