import type {
	MyPullRequestGroup,
	PrioritizedPullRequest,
} from "../prioritizeMyPullRequests";
import {
	assignPullRequestProject,
	OTHER_PROJECT_ID,
	type PullRequestProject,
} from "../pullRequestProjects";

export interface MyPullRequestProjectGroup {
	/** A project id, or OTHER_PROJECT_ID. */
	key: string;
	/** null for Other. */
	name: string | null;
	/** Next-action order kept inside the project. */
	rows: PrioritizedPullRequest[];
	onViewer: number;
	toReview: number;
	toFix: number;
	toMerge: number;
}

/**
 * Regroup the next-action list by the user's projects, in their order, with
 * Other last. Projects without a PR are left out.
 */
export function groupMyPullRequestsByProject(
	groups: MyPullRequestGroup[],
	projects: PullRequestProject[],
	overrides: Record<string, string>,
): MyPullRequestProjectGroup[] {
	const byProject = new Map<string, MyPullRequestProjectGroup>();
	for (const [key, name] of [
		...projects.map((project) => [project.id, project.name] as const),
		[OTHER_PROJECT_ID, null] as const,
	]) {
		byProject.set(key, {
			key,
			name,
			rows: [],
			onViewer: 0,
			toReview: 0,
			toFix: 0,
			toMerge: 0,
		});
	}
	for (const row of groups.flatMap((group) => group.rows)) {
		const key = assignPullRequestProject(row.pr, projects, overrides);
		const project = byProject.get(key) ?? byProject.get(OTHER_PROJECT_ID);
		if (!project) continue;
		project.rows.push(row);
		if (row.action === "later") continue;
		if (row.status.waitingOnViewer) project.onViewer += 1;
		if (row.action === "review") project.toReview += 1;
		if (row.action === "fix") project.toFix += 1;
		if (row.action === "merge") project.toMerge += 1;
	}
	return [...byProject.values()].filter((project) => project.rows.length > 0);
}
