import { describe, expect, it } from "bun:test";
import {
	makeProject,
	makeSection,
	makeWorkspace,
} from "../testProjectFixtures";
import { filterDashboardSidebarProjectsByWorkspace } from "./filterDashboardSidebarProjectsByWorkspace";

const projects = [
	makeProject({
		id: "p1",
		name: "p1",
		isCollapsed: true,
		children: [
			{ type: "workspace", workspace: makeWorkspace({ id: "w1", name: "w1" }) },
			{
				type: "section",
				section: makeSection({
					id: "s1",
					name: "s1",
					isCollapsed: true,
					workspaces: [
						makeWorkspace({ id: "w2", name: "w2" }),
						makeWorkspace({ id: "w3", name: "w3" }),
					],
				}),
			},
		],
	}),
	makeProject({
		id: "p2",
		name: "p2",
		children: [
			{ type: "workspace", workspace: makeWorkspace({ id: "w4", name: "w4" }) },
		],
	}),
];

describe("filterDashboardSidebarProjectsByWorkspace", () => {
	it("keeps matching workspaces, expanding their project and folder", () => {
		const result = filterDashboardSidebarProjectsByWorkspace(
			projects,
			(workspace) => workspace.id === "w3",
		);
		expect(result.map((project) => project.id)).toEqual(["p1"]);
		expect(result[0]?.isCollapsed).toBe(false);
		const section = result[0]?.children[0];
		expect(section?.type).toBe("section");
		if (section?.type !== "section") return;
		expect(section.section.isCollapsed).toBe(false);
		expect(section.section.workspaces.map((workspace) => workspace.id)).toEqual(
			["w3"],
		);
	});

	it("drops projects left empty", () => {
		expect(
			filterDashboardSidebarProjectsByWorkspace(projects, () => false),
		).toEqual([]);
	});
});
