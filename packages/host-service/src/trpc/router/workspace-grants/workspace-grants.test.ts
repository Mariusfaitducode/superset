import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostServiceContext } from "../../../types";
import { workspaceGrantsRouter } from "./workspace-grants";

const home = mkdtempSync(join(tmpdir(), "grants-router-"));
process.env.SUPERSET_HOME_DIR = home;

afterAll(() => {
	rmSync(home, { recursive: true, force: true });
});

const caller = workspaceGrantsRouter.createCaller({
	isAuthenticated: true,
} as unknown as HostServiceContext);

describe("workspaceGrantsRouter", () => {
	test("grants a workspace and lists it with the catalog", async () => {
		await caller.set({ workspaceId: "ws", grants: ["push-own-branch"] });
		const { available, workspaces } = await caller.list();
		expect(available.map((grant) => grant.id)).toContain("slack-draft");
		expect(workspaces.ws?.grants).toEqual(["push-own-branch"]);
	});

	test("answers FORBIDDEN when an agent grants its own workspace", async () => {
		await expect(
			caller.set({
				actor: "agent",
				actorWorkspaceId: "ws",
				workspaceId: "ws",
				grants: ["mark-pr-ready"],
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
