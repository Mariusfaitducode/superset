import { describe, expect, test } from "bun:test";
import type { WorkspaceLabelsState } from "../../components/WorkspaceLabels/labels";
import type { DashboardSidebarPinnedWorkspace } from "../../types";
import {
	makeProject,
	makeSection,
	makeWorkspace,
} from "../testProjectFixtures";
import {
	buildWorkspaceSwitcherOptions,
	type SwitcherTodo,
} from "./buildWorkspaceSwitcherOptions";

const labels = {
	labels: [
		{ id: "l-today", name: "Today", color: "amber" },
		{ id: "l-top", name: "Top priority", color: "red" },
	],
	assignments: { "ws-grouped": ["l-today", "l-top"] },
} as unknown as WorkspaceLabelsState;

function build(
	overrides: Partial<Parameters<typeof buildWorkspaceSwitcherOptions>[0]> = {},
) {
	return buildWorkspaceSwitcherOptions({
		pinnedWorkspaces: [],
		sessionChildren: [],
		projects: [],
		cloudWorkspaces: [],
		labelsByHost: new Map(),
		todos: [],
		...overrides,
	});
}

describe("buildWorkspaceSwitcherOptions", () => {
	test("places a workspace in its project and folder, with their colors", () => {
		const project = makeProject({
			id: "project-1",
			name: "superset",
			color: "#3b82f6",
			children: [
				{
					type: "workspace",
					workspace: makeWorkspace({ id: "ws-top", name: "Top" }),
				},
				{
					type: "section",
					section: makeSection({
						id: "s-1",
						name: "Fork features",
						color: "#22c55e",
						workspaces: [
							makeWorkspace({
								id: "ws-grouped",
								name: "Switcher",
								branch: "feature/switcher-context",
								pullRequest: {
									url: "https://github.com/o/r/pull/12",
									number: 12,
									title: "Switcher",
									state: "draft",
									reviewDecision: null,
									checksStatus: "none",
									checks: [],
								},
							}),
						],
					}),
				},
			],
		});
		const [top, grouped] = build({
			projects: [project],
			labelsByHost: new Map([["host-1", labels]]),
		});
		expect(top).toMatchObject({
			id: "ws-top",
			detail: "superset",
			project: { name: "superset", color: "#3b82f6" },
			section: null,
			labels: [],
			branch: "Top",
			pullRequest: null,
		});
		expect(grouped).toMatchObject({
			id: "ws-grouped",
			project: { name: "superset", color: "#3b82f6" },
			section: { name: "Fork features", color: "#22c55e" },
			branch: "feature/switcher-context",
			pullRequest: { number: 12, state: "draft" },
		});
		expect(grouped?.labels.map((label) => label.name)).toEqual([
			"Today",
			"Top priority",
		]);
	});

	test("treats the default project color as no color", () => {
		const [option] = build({
			projects: [
				makeProject({
					id: "project-1",
					name: "superset",
					color: "default",
					children: [
						{
							type: "workspace",
							workspace: makeWorkspace({ id: "a", name: "A" }),
						},
					],
				}),
			],
		});
		expect(option?.project).toEqual({ name: "superset", color: null });
	});

	test("counts open to-dos per workspace, flagging high priority", () => {
		const todos: SwitcherTodo[] = [
			{ workspaceId: "a", done: false, priority: "high" },
			{ workspaceId: "a", done: false, priority: "normal" },
			{ workspaceId: "a", done: false, priority: "low" },
			{ workspaceId: "a", done: true, priority: "high" },
			{ workspaceId: "other", done: false, priority: "high" },
		];
		const [option] = build({
			projects: [
				makeProject({
					id: "project-1",
					name: "superset",
					children: [
						{
							type: "workspace",
							workspace: makeWorkspace({ id: "a", name: "A" }),
						},
					],
				}),
			],
			todos,
		});
		expect(option?.todos).toEqual({
			open: 3,
			highPriority: 1,
		});
	});

	test("keeps a pinned workspace's project, colored from the project list", () => {
		const pinned: DashboardSidebarPinnedWorkspace = {
			...makeWorkspace({ id: "p", name: "Pinned", projectId: "project-2" }),
			isPinned: true,
			projectName: "website",
			projectIconUrl: null,
		};
		const options = build({
			pinnedWorkspaces: [pinned],
			projects: [
				makeProject({ id: "project-2", name: "website", color: "#ef4444" }),
			],
		});
		expect(options).toHaveLength(1);
		expect(options[0]?.project).toEqual({ name: "website", color: "#ef4444" });
	});

	test("puts session folders as the group of a project-less workspace", () => {
		const [loose, foldered] = build({
			sessionChildren: [
				{
					type: "workspace",
					workspace: makeWorkspace({
						id: "s1",
						name: "Loose",
						projectId: null,
					}),
				},
				{
					type: "section",
					section: makeSection({
						id: "f",
						name: "Research",
						color: "#a855f7",
						workspaces: [
							makeWorkspace({ id: "s2", name: "Deep", projectId: null }),
						],
					}),
				},
			],
		});
		expect(loose).toMatchObject({ detail: null, project: null, section: null });
		expect(foldered).toMatchObject({
			project: null,
			section: { name: "Research", color: "#a855f7" },
		});
	});

	test("lets a project row win over a pinned entry, and lists cloud rows bare", () => {
		const workspace = makeWorkspace({ id: "dup", name: "Dup" });
		const options = build({
			pinnedWorkspaces: [
				{ ...workspace, projectName: "old", projectIconUrl: null },
			],
			projects: [
				makeProject({
					id: "project-1",
					name: "superset",
					children: [{ type: "workspace", workspace }],
				}),
			],
			cloudWorkspaces: [{ id: "cloud-1", name: "Sandbox" }],
		});
		expect(options.map((option) => [option.id, option.detail])).toEqual([
			["dup", "superset"],
			["cloud-1", null],
		]);
		expect(options[1]).toMatchObject({
			labels: [],
			branch: null,
			todos: { open: 0, highPriority: 0 },
		});
	});
});
