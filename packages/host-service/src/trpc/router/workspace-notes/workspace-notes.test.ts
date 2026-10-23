import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostServiceContext } from "../../../types";
import { workspaceNotesRouter } from "./workspace-notes";

const home = mkdtempSync(join(tmpdir(), "notes-router-"));
process.env.SUPERSET_HOME_DIR = home;

afterAll(() => {
	rmSync(home, { recursive: true, force: true });
});

const broadcasts: string[] = [];
const caller = workspaceNotesRouter.createCaller({
	isAuthenticated: true,
	eventBus: {
		broadcastWorkspaceNotesChanged: ({
			workspaceId,
		}: {
			workspaceId: string;
		}) => broadcasts.push(workspaceId),
	},
} as unknown as HostServiceContext);

describe("workspaceNotesRouter", () => {
	test("adds as the user by default and lists by workspace", async () => {
		const [note] = await caller.add({
			workspaceId: "ws",
			items: [{ text: "Keyboard shortcuts" }],
		});
		expect(note?.createdBy).toBe("user");
		expect(await caller.list({ workspaceId: "ws" })).toHaveLength(1);
	});

	test("answers FORBIDDEN when an agent triages the user's note", async () => {
		const [note] = await caller.add({
			workspaceId: "ws",
			items: [{ text: "Mine" }],
		});
		if (!note) throw new Error("not added");
		await expect(
			caller.setStatus({ actor: "agent", id: note.id, status: "dropped" }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			caller.remove({ actor: "agent", id: note.id }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	test("tells the app which workspace changed, once per change", async () => {
		broadcasts.length = 0;
		const added = await caller.add({
			workspaceId: "other",
			items: [{ text: "One" }, { text: "Two" }],
		});
		const first = added[0];
		if (!first) throw new Error("not added");
		await caller.setStatus({ id: first.id, status: "done" });
		await caller.remove({ id: first.id });
		expect(broadcasts).toEqual(["other", "other", "other"]);
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
