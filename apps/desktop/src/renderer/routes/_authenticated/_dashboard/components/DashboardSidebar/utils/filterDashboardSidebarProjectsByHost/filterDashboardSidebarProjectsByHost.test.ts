import { describe, expect, it } from "bun:test";
import {
	makeProject,
	makeSection,
	makeWorkspace,
} from "../testProjectFixtures";
import {
	filterDashboardSidebarProjectsByHost,
	filterDashboardSidebarProjectsByMachine,
} from "./filterDashboardSidebarProjectsByHost";

const local = makeWorkspace({ id: "w-local", name: "fix-login" });
const remote = makeWorkspace({
	id: "w-remote",
	name: "on-laptop",
	hostType: "remote-device",
});
const cloud = makeWorkspace({
	id: "w-cloud",
	name: "sandbox",
	hostType: "cloud",
});
const section = makeSection({
	id: "s1",
	name: "Backend",
	workspaces: [remote, cloud],
});
const projects = [
	makeProject({
		id: "p-mixed",
		name: "Mixed",
		children: [
			{ type: "workspace", workspace: local },
			{ type: "section", section },
		],
	}),
	makeProject({
		id: "p-local-only",
		name: "Local only",
		children: [{ type: "workspace", workspace: local }],
	}),
];

describe("filterDashboardSidebarProjectsByHost", () => {
	it("returns the same array for 'all'", () => {
		expect(filterDashboardSidebarProjectsByHost(projects, "all")).toBe(
			projects,
		);
	});

	it("'local' keeps devices, drops sandboxes, and keeps untouched projects by reference", () => {
		const [mixed, localOnly] = filterDashboardSidebarProjectsByHost(
			projects,
			"local",
		);
		expect(mixed?.children).toEqual([
			{ type: "workspace", workspace: local },
			{ type: "section", section: { ...section, workspaces: [remote] } },
		]);
		expect(localOnly).toBe(projects[1]);
	});

	it("'cloud' keeps sandboxes and drops projects left with nothing", () => {
		const result = filterDashboardSidebarProjectsByHost(projects, "cloud");
		expect(result.map((project) => project.id)).toEqual(["p-mixed"]);
		expect(result[0]?.children).toEqual([
			{ type: "section", section: { ...section, workspaces: [cloud] } },
		]);
	});
});

describe("filterDashboardSidebarProjectsByMachine", () => {
	const onTower = makeWorkspace({
		id: "w-tower",
		name: "gpu",
		hostId: "tower",
	});
	const machineProjects = [
		makeProject({
			id: "p-both",
			name: "Both",
			children: [
				{ type: "workspace", workspace: local },
				{ type: "workspace", workspace: onTower },
			],
		}),
		makeProject({
			id: "p-here",
			name: "Here",
			children: [{ type: "workspace", workspace: local }],
		}),
		makeProject({ id: "p-empty", name: "Empty", children: [] }),
	];

	it("returns the same array with no host selected", () => {
		expect(
			filterDashboardSidebarProjectsByMachine(machineProjects, null, "host-1"),
		).toBe(machineProjects);
	});

	it("keeps only the selected host's rows and drops projects left empty", () => {
		const result = filterDashboardSidebarProjectsByMachine(
			machineProjects,
			"tower",
			"host-1",
		);
		expect(result.map((project) => project.id)).toEqual(["p-both"]);
		expect(result[0]?.children).toEqual([
			{ type: "workspace", workspace: onTower },
		]);
	});

	it("keeps empty projects and untouched projects by reference on this device", () => {
		const result = filterDashboardSidebarProjectsByMachine(
			machineProjects,
			"host-1",
			"host-1",
		);
		expect(result.map((project) => project.id)).toEqual([
			"p-both",
			"p-here",
			"p-empty",
		]);
		expect(result[1]).toBe(machineProjects[1]);
		expect(result[2]).toBe(machineProjects[2]);
	});
});
