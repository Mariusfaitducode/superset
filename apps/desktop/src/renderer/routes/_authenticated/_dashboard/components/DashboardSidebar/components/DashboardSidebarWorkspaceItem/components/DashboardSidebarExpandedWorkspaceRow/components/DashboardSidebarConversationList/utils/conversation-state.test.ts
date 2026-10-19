import { describe, expect, test } from "bun:test";
import {
	deriveConversationState,
	isWaitingOnUser,
	waitingTintLevel,
} from "./conversation-state";

const AT = 1_000_000;

describe("deriveConversationState", () => {
	test("a finished turn nobody has opened is unseen", () => {
		expect(
			deriveConversationState({
				lastEventType: "Stop",
				lastEventAt: AT,
				lastSeenAt: undefined,
			}),
		).toBe("unseen");
		expect(
			deriveConversationState({
				lastEventType: "Stop",
				lastEventAt: AT,
				lastSeenAt: AT - 1,
			}),
		).toBe("unseen");
	});

	test("a finished turn stays flagged as seen until the user replies", () => {
		expect(
			deriveConversationState({
				lastEventType: "Stop",
				lastEventAt: AT,
				lastSeenAt: AT,
			}),
		).toBe("seen");
	});

	test("replying starts a new turn", () => {
		expect(
			deriveConversationState({
				lastEventType: "Start",
				lastEventAt: AT + 10,
				lastSeenAt: AT,
			}),
		).toBe("working");
	});

	test("a permission prompt is a request, seen or not", () => {
		for (const lastSeenAt of [undefined, AT, AT + 5]) {
			expect(
				deriveConversationState({
					lastEventType: "PermissionRequest",
					lastEventAt: AT,
					lastSeenAt,
				}),
			).toBe("request");
		}
	});

	test("a failure is failed, seen or not", () => {
		expect(
			deriveConversationState({
				lastEventType: "Failed",
				lastEventAt: AT,
				lastSeenAt: AT,
			}),
		).toBe("failed");
	});

	test("an agent that never started a turn is idle", () => {
		expect(
			deriveConversationState({
				lastEventType: "Attached",
				lastEventAt: AT,
				lastSeenAt: undefined,
			}),
		).toBe("idle");
	});
});

describe("isWaitingOnUser", () => {
	test("only states that need the user count", () => {
		expect(isWaitingOnUser("unseen")).toBe(true);
		expect(isWaitingOnUser("seen")).toBe(true);
		expect(isWaitingOnUser("request")).toBe(true);
		expect(isWaitingOnUser("failed")).toBe(true);
		expect(isWaitingOnUser("working")).toBe(false);
		expect(isWaitingOnUser("idle")).toBe(false);
	});
});

describe("waitingTintLevel", () => {
	const MIN = 60_000;
	test("grows with the time a conversation has waited", () => {
		expect(waitingTintLevel(5 * MIN)).toBe(0);
		expect(waitingTintLevel(15 * MIN)).toBe(1);
		expect(waitingTintLevel(90 * MIN)).toBe(2);
		expect(waitingTintLevel(5 * 60 * MIN)).toBe(3);
	});

	test("a clock skew never yields a negative level", () => {
		expect(waitingTintLevel(-MIN)).toBe(0);
	});
});
