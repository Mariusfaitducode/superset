import { beforeEach, describe, expect, test } from "bun:test";
import { useConversationRecencyStore } from "./store";

describe("conversation recency", () => {
	beforeEach(() => {
		useConversationRecencyStore.setState({ recent: [] });
	});

	test("moves the conversation on screen to the front without duplicates", () => {
		const { touch } = useConversationRecencyStore.getState();
		touch("t1");
		touch("t2");
		touch("t1");
		expect(useConversationRecencyStore.getState().recent).toEqual(["t1", "t2"]);
	});
});
