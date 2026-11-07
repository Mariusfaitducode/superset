import { describe, expect, test } from "bun:test";
import { assignOfficeGroups } from "./officeGroups";

const PROJECT = "11111111-1111-4111-8111-111111111111";

const folders = [
	{
		sectionId: `${PROJECT}:automation`,
		projectId: PROJECT,
		tabOrder: 0,
		tag: "automation",
		name: "DG Automation",
		color: "#14b8a6",
	},
	{
		sectionId: `${PROJECT}:fork`,
		projectId: PROJECT,
		tabOrder: 1,
		tag: "fork",
		name: "Fork",
		color: "default",
	},
	{
		sectionId: "sessions:notes",
		projectId: "sessions",
		tabOrder: 0,
		tag: "notes",
		name: "Notes",
		color: null,
	},
];

const projects = [{ id: PROJECT, name: "Superset", color: "#e07850" }];

function groupsFor(
	workspaces: {
		id: string;
		projectId: string | null;
		tags?: string[];
	}[],
) {
	return assignOfficeGroups({
		workspaces: workspaces.map((workspace) => ({
			...workspace,
			name: `ws ${workspace.id}`,
		})),
		folders,
		projects,
		sessionsName: "Sessions",
	});
}

describe("assignOfficeGroups", () => {
	test("a tagged workspace joins its folder, with the folder's color", () => {
		const groups = groupsFor([
			{ id: "a", projectId: PROJECT, tags: ["automation"] },
		]);
		expect(groups.get("a")).toEqual({
			key: `folder:${PROJECT}:automation`,
			name: "DG Automation",
			color: "#14b8a6",
		});
	});

	test("a folder on the default color takes its project's", () => {
		const groups = groupsFor([{ id: "a", projectId: PROJECT, tags: ["fork"] }]);
		expect(groups.get("a")?.color).toBe("#e07850");
	});

	test("an untagged workspace joins its project", () => {
		const groups = groupsFor([{ id: "a", projectId: PROJECT }]);
		expect(groups.get("a")).toEqual({
			key: `project:${PROJECT}`,
			name: "Superset",
			color: "#e07850",
		});
	});

	test("sessions go to their folder or to the Sessions lane", () => {
		const groups = groupsFor([
			{ id: "a", projectId: null, tags: ["notes"] },
			{ id: "b", projectId: null },
		]);
		expect(groups.get("a")?.name).toBe("Notes");
		expect(groups.get("b")).toEqual({
			key: "sessions",
			name: "Sessions",
			color: null,
		});
	});

	test("a workspace whose project is unknown stands alone", () => {
		const groups = groupsFor([{ id: "a", projectId: "other" }]);
		expect(groups.get("a")).toEqual({
			key: "workspace:a",
			name: "ws a",
			color: null,
		});
	});
});
