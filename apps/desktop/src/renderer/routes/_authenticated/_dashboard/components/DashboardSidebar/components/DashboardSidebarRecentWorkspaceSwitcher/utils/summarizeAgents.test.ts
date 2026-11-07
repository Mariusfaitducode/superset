import { describe, expect, test } from "bun:test";
import { summarizeAgents } from "./summarizeAgents";

describe("summarizeAgents", () => {
	test("counts requests and errors as needing the user", () => {
		expect(
			summarizeAgents([
				{ state: "request" },
				{ state: "failed" },
				{ state: "working" },
				{ state: "unseen" },
				{ state: "seen" },
				{ state: "idle" },
			]),
		).toEqual({ needsYou: 2, working: 1, done: 2, unseen: 1 });
	});

	test("is all zeros without conversations", () => {
		expect(summarizeAgents([])).toEqual({
			needsYou: 0,
			working: 0,
			done: 0,
			unseen: 0,
		});
	});
});
