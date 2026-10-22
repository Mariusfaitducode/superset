import { describe, expect, test } from "bun:test";
import { type Idea, ideaWorkspace, resolveIdeaId } from "./ideas";

const idea = (id: string) => ({ id }) as Idea;

describe("ideas CLI helpers", () => {
	test("defaults to the workspace it runs in, the flag wins", () => {
		const env = { SUPERSET_WORKSPACE_ID: "ws" };
		expect(ideaWorkspace(undefined, env)).toBe("ws");
		expect(ideaWorkspace("other", env)).toBe("other");
		expect(() => ideaWorkspace(undefined, {})).toThrow();
	});

	test("resolves an unambiguous short id", () => {
		const ideas = [idea("abc123"), idea("abd456")];
		expect(resolveIdeaId("abc", ideas)).toBe("abc123");
		expect(() => resolveIdeaId("ab", ideas)).toThrow(/Several/);
		expect(() => resolveIdeaId("zz", ideas)).toThrow(/not found/);
	});
});
