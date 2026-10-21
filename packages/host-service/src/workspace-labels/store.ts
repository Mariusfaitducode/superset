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

export const LABEL_COLORS = [
	"gray",
	"red",
	"orange",
	"amber",
	"green",
	"teal",
	"blue",
	"violet",
	"pink",
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

export interface WorkspaceLabel {
	id: string;
	name: string;
	color: LabelColor;
}

export interface WorkspaceLabelsState {
	/** In the user's order. */
	labels: WorkspaceLabel[];
	/** workspaceId → label ids, in label order. */
	assignments: Record<string, string[]>;
}

export class WorkspaceLabelError extends Error {}

export const MAX_LABELS = 50;

const DEFAULT_LABELS: Array<Omit<WorkspaceLabel, "id">> = [
	{ name: "Waiting", color: "amber" },
	{ name: "In progress", color: "blue" },
	{ name: "Today", color: "green" },
	{ name: "Top priority", color: "red" },
];

export function defaultLabelsPath(): string {
	const home =
		process.env.SUPERSET_HOME_DIR?.trim() || join(homedir(), ".superset");
	return join(home, "state", "workspace-labels.json");
}

/**
 * Labels the user puts on workspaces to sort their day (waiting, today…),
 * kept apart from tags: a tag is a sidebar folder, so tagging a workspace
 * "today" would move it out of its group. One JSON file under the Superset
 * home, like conversation to-dos, so the fork adds no migration.
 */
export class WorkspaceLabelStore {
	private state: WorkspaceLabelsState | null = null;

	constructor(private readonly filePath: string = defaultLabelsPath()) {}

	list(): WorkspaceLabelsState {
		return this.load();
	}

	createLabel(name: string, color: LabelColor): WorkspaceLabel {
		const state = this.load();
		const trimmed = this.validName(name);
		if (state.labels.length >= MAX_LABELS) {
			throw new WorkspaceLabelError(`At most ${MAX_LABELS} labels`);
		}
		const label = { id: randomUUID(), name: trimmed, color };
		this.save({ ...state, labels: [...state.labels, label] });
		return label;
	}

	updateLabel(
		id: string,
		fields: { name?: string; color?: LabelColor },
	): WorkspaceLabel {
		const state = this.load();
		const label = this.get(id);
		const updated = {
			...label,
			...(fields.name !== undefined
				? { name: this.validName(fields.name, id) }
				: {}),
			...(fields.color ? { color: fields.color } : {}),
		};
		this.save({
			...state,
			labels: state.labels.map((item) => (item.id === id ? updated : item)),
		});
		return updated;
	}

	deleteLabel(id: string): void {
		const state = this.load();
		this.get(id);
		const assignments: Record<string, string[]> = {};
		for (const [workspaceId, ids] of Object.entries(state.assignments)) {
			const kept = ids.filter((labelId) => labelId !== id);
			if (kept.length > 0) assignments[workspaceId] = kept;
		}
		this.save({
			labels: state.labels.filter((label) => label.id !== id),
			assignments,
		});
	}

	setWorkspaceLabels(workspaceId: string, labelIds: string[]): string[] {
		const state = this.load();
		const wanted = new Set(labelIds);
		const ordered = state.labels
			.filter((label) => wanted.has(label.id))
			.map((label) => label.id);
		const { [workspaceId]: _previous, ...rest } = state.assignments;
		this.save({
			...state,
			assignments: ordered.length ? { ...rest, [workspaceId]: ordered } : rest,
		});
		return ordered;
	}

	/** Finds a label by name, ignoring case, for the CLI. */
	findByName(name: string): WorkspaceLabel | undefined {
		const wanted = name.trim().toLocaleLowerCase();
		return this.load().labels.find(
			(label) => label.name.toLocaleLowerCase() === wanted,
		);
	}

	private validName(name: string, ownId?: string): string {
		const trimmed = name.trim();
		if (!trimmed) throw new WorkspaceLabelError("A label needs a name");
		if (trimmed.length > 40) {
			throw new WorkspaceLabelError("A label name is at most 40 characters");
		}
		const taken = this.findByName(trimmed);
		if (taken && taken.id !== ownId) {
			throw new WorkspaceLabelError(`A label is already named ${taken.name}`);
		}
		return trimmed;
	}

	private get(id: string): WorkspaceLabel {
		const label = this.load().labels.find((item) => item.id === id);
		if (!label) throw new WorkspaceLabelError(`Label not found: ${id}`);
		return label;
	}

	private load(): WorkspaceLabelsState {
		if (this.state) return this.state;
		try {
			const file = JSON.parse(readFileSync(this.filePath, "utf8")) as {
				labels?: WorkspaceLabel[];
				assignments?: Record<string, string[]>;
			};
			this.state = {
				labels: Array.isArray(file.labels) ? file.labels : [],
				assignments: file.assignments ?? {},
			};
		} catch {
			// Saved right away, so the default labels keep their ids across
			// restarts of the host.
			this.save({
				labels: DEFAULT_LABELS.map((label) => ({ ...label, id: randomUUID() })),
				assignments: {},
			});
		}
		return this.state as WorkspaceLabelsState;
	}

	private save(state: WorkspaceLabelsState): void {
		this.state = state;
		mkdirSync(dirname(this.filePath), { recursive: true });
		const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
		try {
			writeFileSync(
				temporaryPath,
				JSON.stringify({ version: 1, ...state }, null, "\t"),
			);
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
