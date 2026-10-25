export interface BranchPlace<TWorkspace, TConversation> {
	/** A git worktree has this branch checked out. */
	worktreePath: string | null;
	/** The Superset workspace on this branch, if any. */
	workspace: TWorkspace | null;
	/** Its conversation to open: one waiting on the user first. */
	conversation: TConversation | null;
}

export type RefBadge<TWorkspace = unknown, TConversation = unknown> =
	| ({
			kind: "branch";
			/** Full ref name, refs/heads/x. */
			ref: string;
			label: string;
			isHead: boolean;
			/** Remotes that point at the same commit, e.g. ["origin"]. */
			syncedRemotes: string[];
	  } & BranchPlace<TWorkspace, TConversation>)
	| { kind: "remote"; ref: string; label: string }
	| { kind: "tag"; ref: string; label: string }
	| { kind: "head" };

interface BadgeOptions<TWorkspace, TConversation> {
	showRemotes: boolean;
	showTags: boolean;
	placeOf: (branch: string) => BranchPlace<TWorkspace, TConversation>;
}

/**
 * Turn a commit's decorations into badges. A local branch absorbs the
 * remote branches of the same name on the same commit, so "main" and
 * "origin/main" read as one badge "main · origin".
 */
export function buildRefBadges<TWorkspace, TConversation>(
	refs: string[],
	{ showRemotes, showTags, placeOf }: BadgeOptions<TWorkspace, TConversation>,
): RefBadge<TWorkspace, TConversation>[] {
	const hasHead = refs.includes("HEAD");
	const branches = refs
		.filter((ref) => ref.startsWith("refs/heads/"))
		.map((ref) => ref.slice("refs/heads/".length));
	const remotes = refs
		.filter((ref) => ref.startsWith("refs/remotes/"))
		.map((ref) => {
			const short = ref.slice("refs/remotes/".length);
			const slash = short.indexOf("/");
			return {
				ref,
				short,
				remote: short.slice(0, slash),
				branch: short.slice(slash + 1),
			};
		});
	const absorbed = new Set<string>();
	const badges: RefBadge<TWorkspace, TConversation>[] = [];

	for (const branch of branches) {
		const synced = remotes.filter((remote) => remote.branch === branch);
		for (const remote of synced) absorbed.add(remote.ref);
		badges.push({
			kind: "branch",
			ref: `refs/heads/${branch}`,
			label: branch,
			isHead: hasHead && branches.length > 0 && branch === branches[0],
			syncedRemotes: synced.map((remote) => remote.remote),
			...placeOf(branch),
		});
	}
	if (hasHead && branches.length === 0) badges.unshift({ kind: "head" });
	// Branches with a conversation or a worktree first: they are what you look for.
	badges.sort((a, b) => rank(b) - rank(a));

	if (showRemotes) {
		for (const remote of remotes) {
			if (!absorbed.has(remote.ref)) {
				badges.push({ kind: "remote", ref: remote.ref, label: remote.short });
			}
		}
	}
	if (showTags) {
		for (const ref of refs) {
			if (ref.startsWith("refs/tags/")) {
				badges.push({
					kind: "tag",
					ref,
					label: ref.slice("refs/tags/".length),
				});
			}
		}
	}
	return badges;
}

function rank(badge: RefBadge<unknown, unknown>): number {
	if (badge.kind !== "branch") return badge.kind === "head" ? 4 : 0;
	return (
		(badge.isHead ? 4 : 0) +
		(badge.conversation ? 2 : 0) +
		(badge.worktreePath || badge.workspace ? 1 : 0)
	);
}
