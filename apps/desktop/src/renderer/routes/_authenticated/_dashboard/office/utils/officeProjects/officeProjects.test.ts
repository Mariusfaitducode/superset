import { describe, expect, test } from "bun:test";
import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import type { PullRequestProject } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";
import {
	assignWorkspaceProject,
	indexPullRequestsByBranch,
	projectNotionSpecs,
	workspacePullRequests,
} from "./officeProjects";

const projects: PullRequestProject[] = [
	{
		id: "registry",
		name: "Pipeline Registry",
		labels: [],
		keywords: ["pipeline registry"],
		pullRequests: [],
	},
	{
		id: "cfr",
		name: "21 CFR pt 11",
		labels: ["part-11"],
		keywords: ["audit trail"],
		pullRequests: ["#42"],
	},
];

function pr(overrides: Partial<MyPullRequestItem>): MyPullRequestItem {
	return {
		projectId: "hub",
		repoFullName: "spore/hub",
		prNumber: 1,
		title: "Something",
		url: "https://github.com/spore/hub/pull/1",
		isDraft: false,
		authorLogin: "me",
		updatedAt: null,
		details: null,
		...overrides,
	};
}

const workspace = {
	id: "w1",
	name: "fix flaky tests",
	branch: "marius/flaky",
	projectId: "hub",
	labels: [] as string[],
};

const assign = (
	overrides: Partial<Parameters<typeof assignWorkspaceProject>[0]>,
) =>
	assignWorkspaceProject({
		workspace,
		pullRequests: [],
		projects,
		pullRequestMoves: {},
		manual: {},
		...overrides,
	});

describe("assignWorkspaceProject", () => {
	test("the user's pick wins, unless its project was deleted", () => {
		expect(assign({ manual: { w1: "registry" } })).toEqual({
			projectId: "registry",
			via: "manual",
		});
		expect(assign({ manual: { w1: "gone" } }).via).toBeNull();
	});

	test("then the project of the workspace's PR, with the PR page's rules", () => {
		expect(assign({ pullRequests: [pr({ prNumber: 42 })] })).toEqual({
			projectId: "cfr",
			via: "pullRequest",
		});
		// A PR moved by hand on the PR page drags the workspace along.
		expect(
			assign({
				pullRequests: [pr({ prNumber: 42 })],
				pullRequestMoves: { "spore/hub#42": "registry" },
			}).projectId,
		).toBe("registry");
	});

	test("then a project label, then a keyword in the name or branch", () => {
		expect(
			assign({ workspace: { ...workspace, labels: ["Part-11"] } }),
		).toEqual({ projectId: "cfr", via: "label" });
		expect(
			assign({
				workspace: { ...workspace, branch: "marius/pipeline-registry-m2" },
			}),
		).toEqual({ projectId: "registry", via: "keyword" });
	});

	test("falls back to Other", () => {
		expect(assign({})).toEqual({ projectId: "other", via: null });
	});
});

describe("PRs of a workspace", () => {
	test("match by repo and head branch", () => {
		const index = indexPullRequestsByBranch([
			pr({ prNumber: 7, details: { headRefName: "marius/flaky" } as never }),
			pr({
				prNumber: 8,
				projectId: "other-repo",
				details: { headRefName: "marius/flaky" } as never,
			}),
		]);
		expect(
			workspacePullRequests(workspace, index).map((p) => p.prNumber),
		).toEqual([7]);
	});

	test("Notion specs are collected once from the PRs' ticket links", () => {
		const link = {
			source: "notion" as const,
			url: "https://www.notion.so/spec",
			title: "Spec",
		};
		expect(
			projectNotionSpecs([
				pr({ ticketLinks: [{ ...link, title: null }] }),
				pr({
					ticketLinks: [link, { source: "linear", url: "x", title: null }],
				}),
			]),
		).toEqual([{ url: link.url, title: "Spec" }]);
	});
});
