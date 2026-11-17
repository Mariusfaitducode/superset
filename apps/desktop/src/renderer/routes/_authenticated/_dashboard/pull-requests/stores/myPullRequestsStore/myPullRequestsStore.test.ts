import { beforeEach, describe, expect, it } from "bun:test";
import { DEFAULT_PULL_REQUEST_PROJECTS } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";
import {
	migrateMyPullRequestsState,
	useMyPullRequestsStore,
} from "./myPullRequestsStore";

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
			projects: DEFAULT_PULL_REQUEST_PROJECTS,
			projectMoves: {},
		});
	});

	it("keeps an emptied project list and drops broken projects", () => {
		expect(migrateMyPullRequestsState({ projects: [] }).projects).toEqual([]);
		expect(
			migrateMyPullRequestsState({
				projects: [
					{ id: "a", name: "A", keywords: ["x", 1] },
					{ id: "a", name: "duplicate" },
					{ id: "other", name: "reserved" },
					{ name: "no id" },
				],
				projectMoves: { "acme/web#1": "a", "acme/web#2": 3 },
			}),
		).toMatchObject({
			projects: [
				{ id: "a", name: "A", labels: [], keywords: ["x"], pullRequests: [] },
			],
			projectMoves: { "acme/web#1": "a" },
		});
	});

	it("fills a seeded project's Notion link once, and keeps the user's own", () => {
		const [migrated, own, unlinked] = migrateMyPullRequestsState({
			projects: [
				{ id: "dg-automation", name: "DG" },
				{
					id: "pipeline-registry",
					name: "PR",
					notionUrl: "https://www.notion.so/abc",
					status: "paused",
				},
				{ id: "21-cfr-pt-11", name: "CFR", notionUrl: null, status: null },
			],
		}).projects;
		expect(migrated?.notionUrl).toContain("notion.so/32e931da");
		expect(migrated?.status).toBe("inProgress");
		expect(own).toMatchObject({
			notionUrl: "https://www.notion.so/abc",
			status: "paused",
		});
		expect(unlinked).toMatchObject({ notionUrl: null, status: null });
	});

	it("keeps the project grouping", () => {
		expect(migrateMyPullRequestsState({ groupBy: "project" }).groupBy).toBe(
			"project",
		);
	});
});

describe("projects", () => {
	beforeEach(() => {
		useMyPullRequestsStore.setState({ projects: [], projectMoves: {} });
	});

	it("links a project to Notion pages only, and sets its status", () => {
		const store = useMyPullRequestsStore.getState();
		store.addProject("Alpha");
		store.setProjectNotionUrl("alpha", "https://evil.example.com/x");
		expect(useMyPullRequestsStore.getState().projects[0]?.notionUrl).toBe(
			undefined,
		);
		store.setProjectNotionUrl("alpha", " https://app.notion.com/p/123 ");
		store.setProjectStatus("alpha", "planning");
		expect(useMyPullRequestsStore.getState().projects[0]).toMatchObject({
			notionUrl: "https://app.notion.com/p/123",
			status: "planning",
		});
		store.setProjectNotionUrl("alpha", "");
		expect(useMyPullRequestsStore.getState().projects[0]?.notionUrl).toBe(null);
	});

	it("adds projects with unique ids and reorders them", () => {
		const store = useMyPullRequestsStore.getState();
		store.addProject(" 21 CFR pt 11 ");
		store.addProject("21 CFR pt 11");
		store.addProject("  ");
		store.moveProjectUp("21-cfr-pt-11-2");
		expect(
			useMyPullRequestsStore.getState().projects.map((p) => [p.id, p.name]),
		).toEqual([
			["21-cfr-pt-11-2", "21 CFR pt 11"],
			["21-cfr-pt-11", "21 CFR pt 11"],
		]);
	});

	it("forgets the moves into a deleted project", () => {
		const store = useMyPullRequestsStore.getState();
		store.addProject("A");
		store.addProject("B");
		store.movePullRequestToProject("acme/web#1", "a");
		store.movePullRequestToProject("acme/web#2", "b");
		store.deleteProject("a");
		expect(useMyPullRequestsStore.getState().projectMoves).toEqual({
			"acme/web#2": "b",
		});
		store.movePullRequestToProject("acme/web#2", null);
		expect(useMyPullRequestsStore.getState().projectMoves).toEqual({});
	});

	it("keeps only the most recent moves", () => {
		const store = useMyPullRequestsStore.getState();
		for (let n = 0; n < 205; n++) store.movePullRequestToProject(`r#${n}`, "x");
		const moves = Object.keys(useMyPullRequestsStore.getState().projectMoves);
		expect(moves).toHaveLength(200);
		expect(moves[0]).toBe("r#5");
	});
});
