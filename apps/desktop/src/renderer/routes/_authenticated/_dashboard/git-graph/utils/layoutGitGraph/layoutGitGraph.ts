export interface GraphLine {
	lane: number;
	color: number;
}

export interface GraphRowLayout {
	/** Lane of the commit's node. */
	lane: number;
	color: number;
	/** Lines crossing the whole row untouched. */
	passing: GraphLine[];
	/** Lines from the top of the row into the node (the commit's children). */
	incoming: { from: number; color: number }[];
	/** Lines from the node to the bottom of the row (towards its parents). */
	outgoing: { to: number; color: number }[];
	/** Lanes the row needs, to size the graph column. */
	width: number;
}

interface LayoutCommit {
	hash: string;
	parents: string[];
}

type Lane = { hash: string; color: number } | null;

/**
 * Assign each commit (in topological order, newest first) a lane, and the
 * lines to draw in its row. A lane holds the hash it waits for next; a
 * commit takes the leftmost lane that waits for it, and its first parent
 * inherits that lane, so a branch stays in one column and one color.
 */
export function layoutGitGraph(commits: LayoutCommit[]): GraphRowLayout[] {
	const lanes: Lane[] = [];
	let nextColor = 0;
	const freeSlot = () => {
		const index = lanes.indexOf(null);
		return index === -1 ? lanes.length : index;
	};

	return commits.map((commit) => {
		const before = [...lanes];
		let lane = lanes.findIndex((entry) => entry?.hash === commit.hash);
		let color: number;
		if (lane === -1) {
			lane = freeSlot();
			color = nextColor++;
		} else {
			color = (lanes[lane] as { color: number }).color;
		}

		const incoming: GraphRowLayout["incoming"] = [];
		before.forEach((entry, index) => {
			if (entry?.hash === commit.hash) {
				incoming.push({ from: index, color: entry.color });
				lanes[index] = null;
			}
		});
		const passing = before.flatMap((entry, index) =>
			entry && entry.hash !== commit.hash
				? [{ lane: index, color: entry.color }]
				: [],
		);

		const outgoing: GraphRowLayout["outgoing"] = [];
		commit.parents.forEach((parent, index) => {
			// The first parent always continues this lane, even when another
			// lane already waits for it: both meet at the parent's row, so the
			// main line never jumps to a branch's column.
			const existing =
				index === 0 ? -1 : lanes.findIndex((entry) => entry?.hash === parent);
			if (existing !== -1) {
				outgoing.push({
					to: existing,
					color: (lanes[existing] as { color: number }).color,
				});
				return;
			}
			const target = index === 0 ? lane : freeSlot();
			const parentColor = index === 0 ? color : nextColor++;
			lanes[target] = { hash: parent, color: parentColor };
			outgoing.push({ to: target, color: parentColor });
		});

		while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
		return {
			lane,
			color,
			passing,
			incoming,
			outgoing,
			width: Math.max(before.length, lanes.length, lane + 1),
		};
	});
}
