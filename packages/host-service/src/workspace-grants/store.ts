import {
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** What the user lets agents do without asking, in this order everywhere. */
export const WORKSPACE_GRANTS = [
	{
		id: "push-own-branch",
		description:
			"Push this workspace's own branch (never force-push, never another branch)",
	},
	{ id: "open-draft-pr", description: "Open a draft PR from that branch" },
	{ id: "mark-pr-ready", description: "Mark that PR ready for review" },
	{
		id: "reply-to-bots",
		description: "Reply to review bots (Greptile, CodeRabbit) on that PR",
	},
	{
		id: "post-github-comment",
		description: "Post GitHub comments in the user's name",
	},
	{
		id: "slack-draft",
		description: "Save Slack drafts in the user's name (never send them)",
	},
] as const;

export type GrantId = (typeof WORKSPACE_GRANTS)[number]["id"];
export const GRANT_IDS = WORKSPACE_GRANTS.map((grant) => grant.id) as [
	GrantId,
	...GrantId[],
];
export const GRANT_ACTORS = ["user", "agent"] as const;
export type GrantActor = (typeof GRANT_ACTORS)[number];

export interface WorkspaceGrants {
	grants: GrantId[];
	updatedAt: number;
	updatedBy: GrantActor;
}

export class GrantPermissionError extends Error {}

export const MAX_WORKSPACES = 500;

interface GrantFile {
	version: 1;
	workspaces: Record<string, WorkspaceGrants>;
}

export function defaultGrantsPath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "workspace-grants.json");
}

/**
 * What the user allows the agents of each workspace to do without asking,
 * in one JSON file under the Superset home like labels and notes. Advisory:
 * agents read it at start and follow it, nothing enforces it yet. An agent
 * may grant another workspace (a coordinator does), never its own.
 */
export class WorkspaceGrantStore {
	private workspaces: Record<string, WorkspaceGrants> | null = null;

	constructor(
		private readonly filePath: string = defaultGrantsPath(),
		private readonly now: () => number = Date.now,
	) {}

	list(): Record<string, WorkspaceGrants> {
		return this.load();
	}

	get(workspaceId: string): GrantId[] {
		return this.load()[workspaceId]?.grants ?? [];
	}

	/** Replaces the workspace's grants; unknown ids are dropped. */
	set(input: {
		actor: GrantActor;
		/** The workspace the calling agent runs in. */
		actorWorkspaceId?: string;
		workspaceId: string;
		grants: string[];
	}): GrantId[] {
		if (
			input.actor === "agent" &&
			input.actorWorkspaceId === input.workspaceId
		) {
			throw new GrantPermissionError(
				"An agent can't change its own workspace's grants; ask the user",
			);
		}
		const wanted = new Set(input.grants);
		const grants = GRANT_IDS.filter((id) => wanted.has(id));
		const { [input.workspaceId]: _previous, ...rest } = this.load();
		this.save(
			grants.length
				? {
						...rest,
						[input.workspaceId]: {
							grants,
							updatedAt: this.now(),
							updatedBy: input.actor,
						},
					}
				: rest,
		);
		return grants;
	}

	private load(): Record<string, WorkspaceGrants> {
		if (this.workspaces) return this.workspaces;
		try {
			const file = JSON.parse(readFileSync(this.filePath, "utf8")) as GrantFile;
			this.workspaces =
				file.workspaces && typeof file.workspaces === "object"
					? file.workspaces
					: {};
		} catch {
			this.workspaces = {};
		}
		return this.workspaces;
	}

	private save(workspaces: Record<string, WorkspaceGrants>): void {
		this.workspaces = bound(workspaces);
		mkdirSync(dirname(this.filePath), { recursive: true });
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		try {
			const file: GrantFile = { version: 1, workspaces: this.workspaces };
			writeFileSync(temporaryPath, JSON.stringify(file, null, "\t"));
			renameSync(temporaryPath, this.filePath);
		} catch (error) {
			try {
				unlinkSync(temporaryPath);
			} catch {
				// Best-effort cleanup after a failed write or rename.
			}
			throw error;
		}
	}
}

// Deleted workspaces never come back, so once the cap is reached the
// workspace granted longest ago goes first.
function bound(
	workspaces: Record<string, WorkspaceGrants>,
): Record<string, WorkspaceGrants> {
	const entries = Object.entries(workspaces);
	if (entries.length <= MAX_WORKSPACES) return workspaces;
	return Object.fromEntries(
		entries
			.sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
			.slice(0, MAX_WORKSPACES),
	);
}
