import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUserSimpleGit } from "../../../../runtime/git/simple-git";
import type { HostServiceContext } from "../../../../types";
import { createCallerFactory, router } from "../../../index";
import {
	createTestDb,
	PR_NUMBER,
	PROJECT_ID,
	REPO,
	seedLinkedPullRequest,
} from "../shared/test-db";
import { updateBranch } from "./update-branch";

const tempDirs: string[] = [];
afterAll(() => {
	for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

async function createRepoWithOrigin(): Promise<string> {
	const dir = mkdtempSync(join(tmpdir(), "pr-update-branch-test-"));
	tempDirs.push(dir);
	const git = createUserSimpleGit(dir);
	await git.init();
	await git.addRemote(
		"origin",
		`https://github.com/${REPO.owner}/${REPO.name}.git`,
	);
	return dir;
}

const createCaller = createCallerFactory(router({ updateBranch }));

async function callerWith(
	updateBranchImpl: (args: unknown) => Promise<unknown>,
) {
	const db = createTestDb();
	seedLinkedPullRequest(db, await createRepoWithOrigin());
	const ctx = {
		db,
		github: async () => ({ pulls: { updateBranch: updateBranchImpl } }),
		isAuthenticated: true,
		organizationId: "org-test",
	} as unknown as HostServiceContext;
	return createCaller(ctx);
}

describe("pullRequests.updateBranch", () => {
	test("asks GitHub to merge the base into the PR branch", async () => {
		const calls: unknown[] = [];
		const caller = await callerWith(async (args) => {
			calls.push(args);
			return { data: { message: "Updating pull request branch." } };
		});

		const result = await caller.updateBranch({
			projectId: PROJECT_ID,
			prNumber: PR_NUMBER,
		});

		expect(result).toEqual({ message: "Updating pull request branch." });
		expect(calls).toEqual([
			{ owner: REPO.owner, repo: REPO.name, pull_number: PR_NUMBER },
		]);
	});

	test("reports GitHub's refusal instead of a success", async () => {
		const caller = await callerWith(async () => {
			throw Object.assign(new Error("merge conflict between base and head"), {
				status: 422,
			});
		});

		await expect(
			caller.updateBranch({ projectId: PROJECT_ID, prNumber: PR_NUMBER }),
		).rejects.toThrow();
	});
});
