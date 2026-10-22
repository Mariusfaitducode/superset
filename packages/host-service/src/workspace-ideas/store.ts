import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const IDEA_STATUSES = ["open", "kept", "dropped", "done"] as const;
export const IDEA_ACTORS = ["user", "agent"] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];
/** Who acts on an idea: the user in the app, or an agent through the CLI. */
export type IdeaActor = (typeof IDEA_ACTORS)[number];

export interface WorkspaceIdea {
	id: string;
	workspaceId: string;
	text: string;
	note: string | null;
	status: IdeaStatus;
	createdBy: IdeaActor;
	createdAt: number;
	updatedAt: number;
}

export interface IdeaFields {
	text?: string;
	note?: string | null;
}

export class IdeaPermissionError extends Error {}
export class IdeaNotFoundError extends Error {}

export const MAX_WORKSPACES = 200;
export const MAX_IDEAS_PER_WORKSPACE = 500;

interface IdeaFile {
	version: 1;
	ideas: WorkspaceIdea[];
}

export function defaultIdeasPath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "workspace-ideas.json");
}

/**
 * Ideas the user pins to a workspace, in one JSON file the app and the
 * agents' CLI both go through, like conversation to-dos. Agents may read
 * every idea, add their own and mark any done, but only reword, triage or
 * delete their own: the user's ideas are the user's to judge.
 */
export class WorkspaceIdeaStore {
	private ideas: WorkspaceIdea[] | null = null;

	constructor(
		private readonly filePath: string = defaultIdeasPath(),
		private readonly now: () => number = Date.now,
	) {}

	list(filter: { workspaceId?: string } = {}) {
		return this.load().filter(
			(idea) => !filter.workspaceId || idea.workspaceId === filter.workspaceId,
		);
	}

	add(input: {
		actor: IdeaActor;
		workspaceId: string;
		items: Array<{ text: string; note?: string | null }>;
	}): WorkspaceIdea[] {
		const items = input.items
			.map((item) => ({ text: item.text.trim(), note: cleanNote(item.note) }))
			.filter((item) => item.text);
		if (items.length === 0) throw new Error("An idea needs some text");
		const at = this.now();
		const added = items.map(
			(item): WorkspaceIdea => ({
				id: randomUUID(),
				workspaceId: input.workspaceId,
				text: item.text,
				note: item.note,
				status: "open",
				createdBy: input.actor,
				createdAt: at,
				updatedAt: at,
			}),
		);
		this.save([...this.load(), ...added]);
		return added;
	}

	update(actor: IdeaActor, id: string, fields: IdeaFields): WorkspaceIdea {
		const idea = this.get(id);
		this.assertOwns(actor, idea, "change");
		const text = fields.text?.trim();
		if (fields.text !== undefined && !text) {
			throw new Error("An idea needs some text");
		}
		return this.replace({
			...idea,
			...(text ? { text } : {}),
			...(fields.note !== undefined ? { note: cleanNote(fields.note) } : {}),
		});
	}

	setStatus(actor: IdeaActor, id: string, status: IdeaStatus): WorkspaceIdea {
		const idea = this.get(id);
		if (status !== "done") this.assertOwns(actor, idea, "triage");
		return this.replace({ ...idea, status });
	}

	remove(actor: IdeaActor, id: string): void {
		const idea = this.get(id);
		this.assertOwns(actor, idea, "delete");
		this.save(this.load().filter((item) => item.id !== id));
	}

	private assertOwns(
		actor: IdeaActor,
		idea: WorkspaceIdea,
		action: string,
	): void {
		if (actor === "user" || idea.createdBy === "agent") return;
		throw new IdeaPermissionError(
			`Agents can read the user's ideas and mark them done, but not ${action} them`,
		);
	}

	private get(id: string): WorkspaceIdea {
		const idea = this.load().find((item) => item.id === id);
		if (!idea) throw new IdeaNotFoundError(`Idea not found: ${id}`);
		return idea;
	}

	private replace(idea: WorkspaceIdea): WorkspaceIdea {
		const updated = { ...idea, updatedAt: this.now() };
		this.save(
			this.load().map((item) => (item.id === idea.id ? updated : item)),
		);
		return updated;
	}

	private load(): WorkspaceIdea[] {
		if (this.ideas) return this.ideas;
		try {
			const file = JSON.parse(readFileSync(this.filePath, "utf8")) as IdeaFile;
			this.ideas = Array.isArray(file.ideas) ? file.ideas : [];
		} catch {
			this.ideas = [];
		}
		return this.ideas;
	}

	private save(ideas: WorkspaceIdea[]): void {
		this.ideas = bound(ideas);
		mkdirSync(dirname(this.filePath), { recursive: true });
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		try {
			const file: IdeaFile = { version: 1, ideas: this.ideas };
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

function cleanNote(note: string | null | undefined): string | null {
	return note?.trim() || null;
}

// Deleted workspaces never come back, so once the cap is reached the
// workspace touched longest ago goes first.
function bound(ideas: WorkspaceIdea[]): WorkspaceIdea[] {
	const byWorkspace = new Map<string, WorkspaceIdea[]>();
	for (const idea of ideas) {
		const list = byWorkspace.get(idea.workspaceId) ?? [];
		list.push(idea);
		byWorkspace.set(idea.workspaceId, list);
	}
	const lastTouched = (list: WorkspaceIdea[]) =>
		Math.max(...list.map((idea) => idea.updatedAt));
	return [...byWorkspace.values()]
		.sort((a, b) => lastTouched(b) - lastTouched(a))
		.slice(0, MAX_WORKSPACES)
		.flatMap((list) => list.slice(-MAX_IDEAS_PER_WORKSPACE));
}
