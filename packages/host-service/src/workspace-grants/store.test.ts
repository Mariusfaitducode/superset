import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GrantPermissionError, WorkspaceGrantStore } from "./store";

let dir: string;
let filePath: string;
let store: WorkspaceGrantStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "grants-"));
	filePath = join(dir, "state", "grants.json");
	store = new WorkspaceGrantStore(filePath, () => 1_000);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("WorkspaceGrantStore", () => {
	test("grants nothing by default", () => {
		expect(store.get("ws")).toEqual([]);
		expect(store.list()).toEqual({});
	});

	test("sets grants in catalog order, drops unknown ids, keeps them on disk", () => {
		expect(
			store.set({
				actor: "user",
				workspaceId: "ws",
				grants: ["open-draft-pr", "rm-rf", "push-own-branch"],
			}),
		).toEqual(["push-own-branch", "open-draft-pr"]);
		expect(new WorkspaceGrantStore(filePath).list()).toEqual({
			ws: {
				grants: ["push-own-branch", "open-draft-pr"],
				updatedAt: 1_000,
				updatedBy: "user",
			},
		});
		store.set({ actor: "user", workspaceId: "ws", grants: [] });
		expect(store.list()).toEqual({});
	});

	test("an agent can grant another workspace, never its own", () => {
		expect(
			store.set({
				actor: "agent",
				actorWorkspaceId: "coordinator",
				workspaceId: "ws",
				grants: ["slack-draft"],
			}),
		).toEqual(["slack-draft"]);
		expect(() =>
			store.set({
				actor: "agent",
				actorWorkspaceId: "ws",
				workspaceId: "ws",
				grants: ["push-own-branch"],
			}),
		).toThrow(GrantPermissionError);
		expect(store.get("ws")).toEqual(["slack-draft"]);
	});
});
