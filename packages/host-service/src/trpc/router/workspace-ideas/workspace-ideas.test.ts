import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostServiceContext } from "../../../types";
import { workspaceIdeasRouter } from "./workspace-ideas";

const home = mkdtempSync(join(tmpdir(), "ideas-router-"));
process.env.SUPERSET_HOME_DIR = home;

afterAll(() => {
	rmSync(home, { recursive: true, force: true });
});

const caller = workspaceIdeasRouter.createCaller({
	isAuthenticated: true,
} as unknown as HostServiceContext);

describe("workspaceIdeasRouter", () => {
	test("adds as the user by default and lists by workspace", async () => {
		const [idea] = await caller.add({
			workspaceId: "ws",
			items: [{ text: "Keyboard shortcuts" }],
		});
		expect(idea?.createdBy).toBe("user");
		expect(await caller.list({ workspaceId: "ws" })).toHaveLength(1);
	});

	test("answers FORBIDDEN when an agent triages the user's idea", async () => {
		const [idea] = await caller.add({
			workspaceId: "ws",
			items: [{ text: "Mine" }],
		});
		if (!idea) throw new Error("not added");
		await expect(
			caller.setStatus({ actor: "agent", id: idea.id, status: "dropped" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			caller.remove({ actor: "agent", id: idea.id }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	test("answers NOT_FOUND for an unknown id", async () => {
		await expect(
			caller.setStatus({ id: "missing", status: "kept" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	test("rejects an unknown status", async () => {
		await expect(
			caller.setStatus({ id: "x", status: "maybe" as never }),
		).rejects.toThrow();
	});
});
