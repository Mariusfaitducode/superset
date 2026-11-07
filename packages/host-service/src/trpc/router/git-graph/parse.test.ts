import { describe, expect, test } from "bun:test";
import {
	countStatusLines,
	parseDecorations,
	parseLog,
	parseRefs,
	parseWorktrees,
} from "./parse";

const F = "\x1f";
const R = "\x1e";

describe("parseLog", () => {
	test("reads commits, parents and decorations", () => {
		const output = [
			[
				"a1",
				"b2 c3",
				"Ada",
				"ada@x.dev",
				"1700000000",
				"Merge feature",
				"HEAD -> refs/heads/main, refs/remotes/origin/main, refs/remotes/origin/HEAD, tag: refs/tags/v1",
			].join(F),
			["b2", "", "Bob", "bob@x.dev", "1690000000", "Initial: a | b", ""].join(
				F,
			),
		]
			.map((record) => `${record}${R}\n`)
			.join("");
		expect(parseLog(output)).toEqual([
			{
				hash: "a1",
				parents: ["b2", "c3"],
				authorName: "Ada",
				authorEmail: "ada@x.dev",
				authoredAt: 1700000000,
				subject: "Merge feature",
				refs: [
					"HEAD",
					"refs/heads/main",
					"refs/remotes/origin/main",
					"refs/tags/v1",
				],
			},
			{
				hash: "b2",
				parents: [],
				authorName: "Bob",
				authorEmail: "bob@x.dev",
				authoredAt: 1690000000,
				subject: "Initial: a | b",
				refs: [],
			},
		]);
	});

	test("handles a detached HEAD decoration", () => {
		expect(parseDecorations("HEAD, refs/heads/x")).toEqual([
			"HEAD",
			"refs/heads/x",
		]);
	});
});

describe("parseRefs", () => {
	test("classifies refs, peels annotated tags and skips origin/HEAD", () => {
		const output = [
			["refs/heads/main", "aaa", "", "100", "", "origin/main"].join(F),
			["refs/remotes/origin/HEAD", "aaa", "", "100", "", ""].join(F),
			["refs/remotes/origin/main", "aaa", "", "100", "", ""].join(F),
			["refs/tags/v1", "tagobj", "ccc", "", "90", ""].join(F),
		].join("\n");
		expect(parseRefs(output)).toEqual([
			{
				name: "refs/heads/main",
				shortName: "main",
				kind: "branch",
				hash: "aaa",
				committedAt: 100,
				upstream: "origin/main",
			},
			{
				name: "refs/remotes/origin/main",
				shortName: "origin/main",
				kind: "remote",
				hash: "aaa",
				committedAt: 100,
				upstream: null,
			},
			{
				name: "refs/tags/v1",
				shortName: "v1",
				kind: "tag",
				hash: "ccc",
				committedAt: 90,
				upstream: null,
			},
		]);
	});
});

describe("parseWorktrees", () => {
	test("reads the porcelain listing, first entry is the main checkout", () => {
		const output =
			"worktree /repo\nHEAD aaa\nbranch refs/heads/main\n\nworktree /repo-wt\nHEAD bbb\ndetached\n\n";
		expect(parseWorktrees(output)).toEqual([
			{ path: "/repo", head: "aaa", branch: "main", isMain: true },
			{ path: "/repo-wt", head: "bbb", branch: null, isMain: false },
		]);
	});
});

test("countStatusLines ignores blank lines", () => {
	expect(countStatusLines(" M a.ts\n?? b.ts\n")).toBe(2);
	expect(countStatusLines("")).toBe(0);
});
