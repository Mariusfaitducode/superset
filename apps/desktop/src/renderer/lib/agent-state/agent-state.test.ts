import { describe, expect, test } from "bun:test";
import {
	agentStateFromConversation,
	agentStateFromPaneStatus,
	isBlockedOnUser,
	mostUrgentAgentState,
} from "./agent-state";

describe("agentStateFromConversation", () => {
	test("maps the six conversation states to the five shown", () => {
		expect(agentStateFromConversation("request")).toBe("needsYou");
		expect(agentStateFromConversation("working")).toBe("working");
		expect(agentStateFromConversation("unseen")).toBe("unseen");
		expect(agentStateFromConversation("failed")).toBe("failed");
		expect(agentStateFromConversation("idle")).toBe("idle");
	});

	test("a finished turn once opened is idle", () => {
		expect(agentStateFromConversation("seen")).toBe("idle");
	});
});

describe("agentStateFromPaneStatus", () => {
	test("maps the workspace status to the same states", () => {
		expect(agentStateFromPaneStatus("permission")).toBe("needsYou");
		expect(agentStateFromPaneStatus("review")).toBe("unseen");
		expect(agentStateFromPaneStatus("working")).toBe("working");
		expect(agentStateFromPaneStatus("failed")).toBe("failed");
		expect(agentStateFromPaneStatus(null)).toBe("idle");
	});
});

describe("mostUrgentAgentState", () => {
	test("is idle with nothing", () => {
		expect(mostUrgentAgentState([])).toBe("idle");
		expect(mostUrgentAgentState([null, undefined])).toBe("idle");
	});

	test("ranks failed, needs you, unseen, working, idle", () => {
		expect(mostUrgentAgentState(["working", "unseen"])).toBe("unseen");
		expect(mostUrgentAgentState(["unseen", "needsYou", "working"])).toBe(
			"needsYou",
		);
		expect(mostUrgentAgentState(["needsYou", "failed"])).toBe("failed");
		expect(mostUrgentAgentState(["idle", "working"])).toBe("working");
	});
});

test("isBlockedOnUser", () => {
	expect(isBlockedOnUser("needsYou")).toBe(true);
	expect(isBlockedOnUser("failed")).toBe(true);
	expect(isBlockedOnUser("unseen")).toBe(false);
	expect(isBlockedOnUser("working")).toBe(false);
	expect(isBlockedOnUser("idle")).toBe(false);
});
