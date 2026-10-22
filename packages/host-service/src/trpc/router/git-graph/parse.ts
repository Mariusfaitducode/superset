export interface GraphCommit {
	hash: string;
	parents: string[];
	authorName: string;
	authorEmail: string;
	/** Unix seconds. */
	authoredAt: number;
	subject: string;
	/** Full ref names pointing here: refs/heads/x, refs/remotes/origin/x, refs/tags/v1, HEAD. */
	refs: string[];
}

export type GraphRefKind = "branch" | "remote" | "tag";

export interface GraphRef {
	/** Full ref name, e.g. refs/remotes/origin/main. */
	name: string;
	/** Short name, e.g. origin/main. */
	shortName: string;
	kind: GraphRefKind;
	hash: string;
	/** Unix seconds of the commit it points at. */
	committedAt: number;
	/** Local branch's upstream short name, e.g. origin/main. */
	upstream: string | null;
}

export interface GraphWorktree {
	path: string;
	head: string | null;
	/** Short branch name; null when detached. */
	branch: string | null;
	isMain: boolean;
}

export const FIELD_SEPARATOR = "\x1f";
export const RECORD_SEPARATOR = "\x1e";

export const LOG_FORMAT = ["%H", "%P", "%an", "%ae", "%at", "%s", "%D"]
	.join("%x1f")
	.concat("%x1e");

export function parseLog(output: string): GraphCommit[] {
	return output
		.split(RECORD_SEPARATOR)
		.map((record) => record.replace(/^\n/, ""))
		.filter((record) => record.length > 0)
		.map((record) => {
			const [
				hash = "",
				parents = "",
				authorName = "",
				authorEmail = "",
				at = "0",
				subject = "",
				decorations = "",
			] = record.split(FIELD_SEPARATOR);
			return {
				hash,
				parents: parents.split(" ").filter(Boolean),
				authorName,
				authorEmail,
				authoredAt: Number.parseInt(at, 10) || 0,
				subject,
				refs: parseDecorations(decorations),
			};
		})
		.filter((commit) => commit.hash.length > 0);
}

/** `%D` with --decorate=full: "HEAD -> refs/heads/main, tag: refs/tags/v1, refs/remotes/origin/main". */
export function parseDecorations(decorations: string): string[] {
	return (
		decorations
			.split(", ")
			.map((part) => part.trim())
			.filter(Boolean)
			.flatMap((part) => {
				if (part.startsWith("HEAD -> ")) return ["HEAD", part.slice(8)];
				if (part.startsWith("tag: ")) return [part.slice(5)];
				return [part];
			})
			// origin/HEAD is a pointer to the default branch, not a branch.
			.filter((ref) => !/^refs\/remotes\/[^/]+\/HEAD$/.test(ref))
	);
}

export const REF_FORMAT = [
	"%(refname)",
	"%(objectname)",
	"%(*objectname)",
	"%(committerdate:unix)",
	"%(*committerdate:unix)",
	"%(upstream:short)",
].join("%1f");

export function parseRefs(output: string): GraphRef[] {
	return output
		.split("\n")
		.filter(Boolean)
		.flatMap((line): GraphRef[] => {
			const [
				name = "",
				object = "",
				peeled = "",
				date = "",
				peeledDate = "",
				upstream = "",
			] = line.split(FIELD_SEPARATOR);
			const kind: GraphRefKind | null = name.startsWith("refs/heads/")
				? "branch"
				: name.startsWith("refs/remotes/")
					? "remote"
					: name.startsWith("refs/tags/")
						? "tag"
						: null;
			if (!kind || /^refs\/remotes\/[^/]+\/HEAD$/.test(name)) return [];
			return [
				{
					name,
					shortName: name.replace(/^refs\/(heads|remotes|tags)\//, ""),
					kind,
					// Annotated tags point at a tag object; the commit is the peeled one.
					hash: peeled || object,
					committedAt: Number.parseInt(peeledDate || date, 10) || 0,
					upstream: upstream || null,
				},
			];
		});
}

export function parseWorktrees(output: string): GraphWorktree[] {
	return output
		.split("\n\n")
		.map((block) => block.trim())
		.filter(Boolean)
		.map((block, index) => {
			const lines = block.split("\n");
			const value = (key: string) =>
				lines
					.find((line) => line.startsWith(`${key} `))
					?.slice(key.length + 1) ?? null;
			const branch = value("branch");
			return {
				path: value("worktree") ?? "",
				head: value("HEAD"),
				branch: branch ? branch.replace(/^refs\/heads\//, "") : null,
				isMain: index === 0,
			};
		})
		.filter((worktree) => worktree.path.length > 0);
}

export function countStatusLines(output: string): number {
	return output.split("\n").filter((line) => line.trim().length > 0).length;
}
