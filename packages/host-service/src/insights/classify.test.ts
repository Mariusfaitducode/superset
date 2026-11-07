import { describe, expect, test } from "bun:test";
import { MESSAGE_FLAGS, messageFlags, parseTranscriptLine } from "./classify";

const user = (content: unknown, extra: Record<string, unknown> = {}) =>
	JSON.stringify({
		type: "user",
		timestamp: "2026-10-14T10:00:00.000Z",
		message: { role: "user", content },
		...extra,
	});

describe("parseTranscriptLine", () => {
	test("keeps only what a person typed as human", () => {
		expect(parseTranscriptLine(user("commit et push"))?.event[1]).toBe("human");
		expect(
			parseTranscriptLine(user([{ type: "tool_result", content: "ok" }]))
				?.event[1],
		).toBe("tool_result");
		expect(parseTranscriptLine(user("<task-notification>x"))?.event[1]).toBe(
			"other",
		);
		expect(parseTranscriptLine(user("hi", { isMeta: true }))?.event[1]).toBe(
			"other",
		);
		expect(
			parseTranscriptLine(user("hi", { origin: { kind: "agent" } }))?.event[1],
		).toBe("other");
		expect(
			parseTranscriptLine(user("[Request interrupted by user]"))?.event[1],
		).toBe("interrupt");
	});

	test("reads stop events and tool names, and skips other line types", () => {
		const stop = JSON.stringify({
			type: "system",
			subtype: "turn_duration",
			timestamp: "2026-10-14T10:00:00.000Z",
		});
		expect(parseTranscriptLine(stop)?.event[1]).toBe("stop");
		const assistant = JSON.stringify({
			type: "assistant",
			timestamp: "2026-10-14T10:00:00.000Z",
			message: {
				content: [
					{ type: "text", text: "ok" },
					{ type: "tool_use", name: "Bash" },
				],
			},
		});
		expect(parseTranscriptLine(assistant)?.event).toEqual([
			Date.parse("2026-10-14T10:00:00.000Z"),
			"assistant",
			2,
			"Bash",
		]);
		expect(parseTranscriptLine('{"type":"attachment"}')).toBeNull();
		expect(parseTranscriptLine("not json")).toBeNull();
	});
});

describe("messageFlags", () => {
	test.each([
		["commit et push", MESSAGE_FLAGS.goAhead],
		["très bien tu peux post", MESSAGE_FLAGS.goAhead],
		["où en sommes-nous ?", MESSAGE_FLAGS.statusCheck],
		["non pas ça", MESSAGE_FLAGS.correction],
		["Tu es l'agent de la feature X", MESSAGE_FLAGS.agentWritten],
		["Ajoute une colonne triée par date", 0],
	])("%s", (text, flags) => {
		expect(messageFlags(text)).toBe(flags);
	});
});
