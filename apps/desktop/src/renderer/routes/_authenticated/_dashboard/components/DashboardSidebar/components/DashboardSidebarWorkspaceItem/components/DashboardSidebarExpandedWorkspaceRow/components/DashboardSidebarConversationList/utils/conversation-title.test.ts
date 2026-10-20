import { describe, expect, test } from "bun:test";
import { pickConversationTitle } from "./conversation-title";

const base = {
	customTitle: null,
	tabName: null,
	runtimeTitle: null,
	agentLabel: "Claude",
};

describe("pickConversationTitle", () => {
	test("prefers the session name the user chose", () => {
		expect(
			pickConversationTitle({
				...base,
				customTitle: "Fix login",
				tabName: "Review",
				runtimeTitle: "Topic",
			}),
		).toBe("Fix login");
	});

	test("uses the tab's name before the agent's title", () => {
		expect(
			pickConversationTitle({
				...base,
				tabName: "Review",
				runtimeTitle: "Topic",
			}),
		).toBe("Review");
	});

	test("skips a tab named after the agent", () => {
		expect(
			pickConversationTitle({
				...base,
				tabName: "claude",
				runtimeTitle: "Topic",
			}),
		).toBe("Topic");
	});

	test("falls back to the agent's label", () => {
		expect(pickConversationTitle({ ...base, tabName: "Claude" })).toBe(
			"Claude",
		);
	});
});
