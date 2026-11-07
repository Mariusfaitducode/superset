import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitGraphCommitTask } from "./git.ts";

let repo: string;
const git = (...args: string[]) =>
	execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const read = (hash: string) =>
	gitGraphCommitTask.handler({ repoPath: repo, hash }, () => {});

beforeAll(() => {
	repo = mkdtempSync(join(tmpdir(), "git-graph-commit-"));
	git("init", "-q", "-b", "main");
	git("config", "user.name", "Ada");
	git("config", "user.email", "ada@x.dev");
	git("config", "commit.gpgsign", "false");
	writeFileSync(join(repo, "a.txt"), "one\ntwo\n");
	writeFileSync(join(repo, "bin.dat"), Buffer.from([0, 1, 2, 0, 255]));
	git("add", ".");
	git("commit", "-q", "-m", "root");
	git("mv", "a.txt", "b.txt");
	writeFileSync(join(repo, "c.txt"), "new\n");
	git("add", ".");
	git("commit", "-q", "-m", "rename\n\nBody line\x1fwith a separator");
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("gitGraphCommitTask", () => {
	test("a root commit lists every file it adds", async () => {
		const root = git("rev-list", "--max-parents=0", "HEAD");
		const details = await read(root);
		expect(details.parents).toEqual([]);
		expect(details.message).toBe("root");
		expect(details.files).toEqual([
			{
				path: "a.txt",
				oldPath: undefined,
				status: "added",
				additions: 2,
				deletions: 0,
				isBinary: false,
			},
			{
				path: "bin.dat",
				oldPath: undefined,
				status: "added",
				additions: 0,
				deletions: 0,
				isBinary: true,
			},
		]);
	});

	test("reads the full message, people and renames against the parent", async () => {
		const head = git("rev-parse", "HEAD");
		const details = await read(head.slice(0, 10));
		expect(details.hash).toBe(head);
		expect(details.parents).toEqual([git("rev-parse", "HEAD^")]);
		expect(details.message).toBe("rename\n\nBody line\x1fwith a separator");
		expect(details.authorName).toBe("Ada");
		expect(details.committerEmail).toBe("ada@x.dev");
		expect(details.committedAt).toBeGreaterThan(0);
		expect(
			details.files.map((file) => [file.status, file.oldPath, file.path]),
		).toEqual([
			["renamed", "a.txt", "b.txt"],
			["added", undefined, "c.txt"],
		]);
	});

	test("an unknown commit fails instead of returning an empty commit", async () => {
		await expect(read("deadbeefdeadbeef")).rejects.toThrow();
	});
});
