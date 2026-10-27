import type {
	MyPullRequestGroup,
	PrioritizedPullRequest,
} from "../prioritizeMyPullRequests";

export interface MyPullRequestProjectGroup {
	/** Lowercased `owner/name`: a project is its GitHub repo here. */
	key: string;
	repoFullName: string;
	projectId: string;
	/** Next-action order kept inside the project. */
	rows: PrioritizedPullRequest[];
	onViewer: number;
	toReview: number;
	toFix: number;
	toMerge: number;
}

/**
 * Regroup the next-action list by project. Projects with the most PRs
 * waiting on the viewer come first, then by name.
 */
export function groupMyPullRequestsByProject(
	groups: MyPullRequestGroup[],
): MyPullRequestProjectGroup[] {
	const byRepo = new Map<string, MyPullRequestProjectGroup>();
	for (const row of groups.flatMap((group) => group.rows)) {
		const key = row.pr.repoFullName.toLowerCase();
		let project = byRepo.get(key);
		if (!project) {
			project = {
				key,
				repoFullName: row.pr.repoFullName,
				projectId: row.pr.projectId,
				rows: [],
				onViewer: 0,
				toReview: 0,
				toFix: 0,
				toMerge: 0,
			};
			byRepo.set(key, project);
		}
		project.rows.push(row);
		if (row.action === "later") continue;
		if (row.status.waitingOnViewer) project.onViewer += 1;
		if (row.action === "review") project.toReview += 1;
		if (row.action === "fix") project.toFix += 1;
		if (row.action === "merge") project.toMerge += 1;
	}
	return [...byRepo.values()].sort(
		(a, b) => b.onViewer - a.onViewer || a.key.localeCompare(b.key),
	);
}
