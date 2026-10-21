import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostServiceContext } from "../../../types";
import { workspaceLabelsRouter } from "./workspace-labels";

const home = mkdtempSync(join(tmpdir(), "labels-router-"));
process.env.SUPERSET_HOME_DIR = home;

afterAll(() => {
	rmSync(home, { recursive: true, force: true });
});

const caller = workspaceLabelsRouter.createCaller({
	isAuthenticated: true,
} as unknown as HostServiceContext);

describe("workspaceLabelsRouter", () => {
	test("labels a workspace and lists it", async () => {
		const { labels } = await caller.list();
		const today = labels.find((label) => label.name === "Today");
		if (!today) throw new Error("expected the default Today label");
		await caller.setWorkspaceLabels({
			workspaceId: "ws",
			labelIds: [today.id],
		});
		expect((await caller.list()).assignments).toEqual({ ws: [today.id] });
	});

	test("answers BAD_REQUEST for a duplicate name", async () => {
		await expect(
			caller.createLabel({ name: "waiting", color: "gray" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
