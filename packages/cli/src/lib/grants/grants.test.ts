import { describe, expect, test } from "bun:test";
import { findGrants, type Grant, grantActor, grantWorkspace } from "./grants";

const available = [
	{ id: "push-own-branch", description: "Push" },
	{ id: "slack-draft", description: "Draft" },
] as Grant[];

describe("grants CLI helpers", () => {
	test("finds grants by id, ignoring case", () => {
		expect(findGrants(["SLACK-DRAFT", "push-own-branch"], available)).toEqual([
			"slack-draft",
			"push-own-branch",
		]);
		expect(() => findGrants(["merge"], available)).toThrow(
			/No grant named merge/,
		);
	});

	test("defaults to the terminal's workspace", () => {
		expect(grantWorkspace(undefined, { SUPERSET_WORKSPACE_ID: "ws" })).toBe(
			"ws",
		);
		expect(() => grantWorkspace(undefined, {})).toThrow();
	});

	test("an agent says which workspace it runs in", () => {
		expect(
			grantActor({ SUPERSET_AGENT_ID: "a", SUPERSET_WORKSPACE_ID: "ws" }),
		).toEqual({ actor: "agent", actorWorkspaceId: "ws" });
		expect(grantActor({ SUPERSET_WORKSPACE_ID: "ws" })).toEqual({
			actor: "user",
		});
	});
});
