import type { MyPullRequestItem } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/describeMyPullRequest";
import { branchKey } from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/matchPullRequestWorkspace";
import {
	assignPullRequestProject,
	OTHER_PROJECT_ID,
	type PullRequestProject,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/utils/pullRequestProjects";

/** How a workspace got its project, shown so a wrong guess is easy to spot. */
export type ProjectVia = "manual" | "pullRequest" | "label" | "keyword";

export interface ProjectableWorkspace {
	id: string;
	name: string;
	branch: string;
	/** The host project (repo) it belongs to. */
	projectId: string | null;
	labels: readonly string[];
}

export interface WorkspaceProject {
	projectId: string;
	via: ProjectVia | null;
}

function normalize(text: string): string {
	return text
		.toLowerCase()
		.replace(/[\s_/-]+/g, " ")
		.trim();
}

/** Open PRs by the workspace they come from: same repo, same head branch. */
export function indexPullRequestsByBranch(
	pullRequests: readonly MyPullRequestItem[],
): Map<string, MyPullRequestItem[]> {
	const index = new Map<string, MyPullRequestItem[]>();
	for (const pr of pullRequests) {
		const head = pr.details?.headRefName;
		if (!head) continue;
		const key = branchKey(pr.projectId, head);
		const list = index.get(key) ?? [];
		list.push(pr);
		index.set(key, list);
	}
	return index;
}

export function workspacePullRequests(
	workspace: Pick<ProjectableWorkspace, "projectId" | "branch">,
	index: ReadonlyMap<string, MyPullRequestItem[]>,
): MyPullRequestItem[] {
	if (!workspace.projectId || !workspace.branch) return [];
	return index.get(branchKey(workspace.projectId, workspace.branch)) ?? [];
}

/**
 * A workspace's project, as the PR page's projects define them: the one the
 * user picked, else its PR's project (same rules and moves as the PR page),
 * else a project label on the workspace, else a keyword in its name or
 * branch, else Other. A pick of a deleted project falls back to the rules.
 */
export function assignWorkspaceProject({
	workspace,
	pullRequests,
	projects,
	pullRequestMoves,
	manual,
}: {
	workspace: ProjectableWorkspace;
	pullRequests: readonly MyPullRequestItem[];
	projects: readonly PullRequestProject[];
	pullRequestMoves: Record<string, string>;
	manual: Record<string, string>;
}): WorkspaceProject {
	const picked = manual[workspace.id];
	if (
		picked === OTHER_PROJECT_ID ||
		(picked && projects.some((project) => project.id === picked))
	) {
		return { projectId: picked, via: "manual" };
	}
	for (const pr of pullRequests) {
		const projectId = assignPullRequestProject(
			pr,
			[...projects],
			pullRequestMoves,
		);
		if (projectId !== OTHER_PROJECT_ID)
			return { projectId, via: "pullRequest" };
	}
	const labels = new Set(workspace.labels.map((label) => label.toLowerCase()));
	const byLabel = projects.find((project) =>
		project.labels.some((label) => labels.has(label.trim().toLowerCase())),
	);
	if (byLabel) return { projectId: byLabel.id, via: "label" };
	const haystack = normalize(`${workspace.name}\n${workspace.branch}`);
	const byKeyword = projects.find((project) =>
		[project.name, ...project.keywords].some((keyword) => {
			const needle = normalize(keyword);
			return needle.length > 0 && haystack.includes(needle);
		}),
	);
	if (byKeyword) return { projectId: byKeyword.id, via: "keyword" };
	return { projectId: OTHER_PROJECT_ID, via: null };
}

export interface NotionSpec {
	url: string;
	title: string | null;
}

/** The Notion tickets the project's PRs link to, once each. */
export function projectNotionSpecs(
	pullRequests: readonly MyPullRequestItem[],
): NotionSpec[] {
	const byUrl = new Map<string, NotionSpec>();
	for (const pr of pullRequests) {
		for (const link of pr.ticketLinks ?? []) {
			if (link.source !== "notion") continue;
			const known = byUrl.get(link.url);
			if (!known || (!known.title && link.title)) {
				byUrl.set(link.url, { url: link.url, title: link.title });
			}
		}
	}
	return [...byUrl.values()];
}
