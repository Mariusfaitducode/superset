import { describe, expect, it } from "bun:test";
import { migrateMyPullRequestsState } from "./myPullRequestsStore";

describe("migrateMyPullRequestsState", () => {
	it("drops unknown values from an old or broken payload", () => {
		expect(
			migrateMyPullRequestsState({
				repos: ["acme/web", 3],
				roles: ["author", "owner"],
				states: ["ci-failing", "green"],
				age: "year",
				pinned: "acme/web#1",
			}),
		).toEqual({
			repos: ["acme/web"],
			roles: ["author"],
			states: ["ci-failing"],
			age: "any",
			pinned: [],
			later: [],
			groupBy: "action",
		});
	});

	it("keeps the project grouping", () => {
		expect(migrateMyPullRequestsState({ groupBy: "project" }).groupBy).toBe(
			"project",
		);
	});
});
