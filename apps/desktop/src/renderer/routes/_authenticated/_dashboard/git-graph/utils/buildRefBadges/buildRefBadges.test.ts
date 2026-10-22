import { describe, expect, it } from "bun:test";
import { buildRefBadges } from "./buildRefBadges";

const nowhere = () => ({
	worktreePath: null,
	workspace: null,
	conversation: null,
});

describe("buildRefBadges", () => {
	it("folds origin/x into the local branch x and marks HEAD", () => {
		expect(
			buildRefBadges(
				[
					"HEAD",
					"refs/heads/main",
					"refs/remotes/origin/main",
					"refs/remotes/origin/other",
					"refs/tags/v1",
				],
				{ showRemotes: true, showTags: true, placeOf: nowhere },
			),
		).toEqual([
			{
				kind: "branch",
				ref: "refs/heads/main",
				label: "main",
				isHead: true,
				syncedRemotes: ["origin"],
				worktreePath: null,
				workspace: null,
				conversation: null,
			},
			{
				kind: "remote",
				ref: "refs/remotes/origin/other",
				label: "origin/other",
			},
			{ kind: "tag", ref: "refs/tags/v1", label: "v1" },
		]);
	});

	it("hides remotes and tags when asked and shows a detached HEAD", () => {
		expect(
			buildRefBadges(["HEAD", "refs/remotes/origin/x", "refs/tags/v1"], {
				showRemotes: false,
				showTags: false,
				placeOf: nowhere,
			}),
		).toEqual([{ kind: "head" }]);
	});

	it("puts branches with a conversation or a worktree first", () => {
		const badges = buildRefBadges(
			["refs/heads/a", "refs/heads/b", "refs/heads/c"],
			{
				showRemotes: false,
				showTags: false,
				placeOf: (branch) => ({
					worktreePath: branch === "c" ? "/wt/c" : null,
					workspace: null,
					conversation: branch === "b" ? { id: "conv" } : null,
				}),
			},
		);
		expect(
			badges.map((badge) => (badge.kind === "branch" ? badge.label : "")),
		).toEqual(["b", "c", "a"]);
	});
});
