import {
	isActiveNote,
	sortNotes,
	type WorkspaceNote,
} from "../../../components/DashboardSidebar/components/WorkspaceNotes/notes";

export type NotesStatusFilter = "open" | "all";

export interface NotesWorkspace {
	id: string;
	hostId: string;
	name: string;
	branch: string;
}

export interface NoteGroup {
	workspace: NotesWorkspace;
	/** The notes shown under the filters, active ones first. */
	notes: WorkspaceNote[];
	lastUpdatedAt: number;
}

export interface NoteGroupsResult {
	groups: NoteGroup[];
	/** Notes matching the search and workspace, by status filter. */
	counts: Record<NotesStatusFilter, number>;
	/** Workspaces holding notes, with how many are still open. */
	workspaceOptions: Array<{ workspaceId: string; name: string; count: number }>;
}

function matches(note: WorkspaceNote, query: string): boolean {
	return (
		note.text.toLowerCase().includes(query) ||
		(note.details?.toLowerCase().includes(query) ?? false)
	);
}

/**
 * Notes grouped by workspace for the Notes view, the workspace touched last
 * first. Notes of workspaces the app no longer lists are left out.
 */
export function buildNoteGroups(
	workspaces: NotesWorkspace[],
	notes: WorkspaceNote[],
	filters: {
		status: NotesStatusFilter;
		workspaceId: string | null;
		search: string;
	},
): NoteGroupsResult {
	const query = filters.search.trim().toLowerCase();
	const byId = new Map(
		workspaces.map((workspace) => [workspace.id, workspace]),
	);
	const byWorkspace = new Map<string, WorkspaceNote[]>();
	for (const note of notes) {
		if (!byId.has(note.workspaceId)) continue;
		const list = byWorkspace.get(note.workspaceId) ?? [];
		list.push(note);
		byWorkspace.set(note.workspaceId, list);
	}

	const counts: Record<NotesStatusFilter, number> = { open: 0, all: 0 };
	const groups: NoteGroup[] = [];
	const workspaceOptions: NoteGroupsResult["workspaceOptions"] = [];

	for (const [workspaceId, list] of byWorkspace) {
		const workspace = byId.get(workspaceId);
		if (!workspace) continue;
		workspaceOptions.push({
			workspaceId,
			name: workspace.name,
			count: list.filter(isActiveNote).length,
		});
		if (filters.workspaceId && filters.workspaceId !== workspaceId) continue;

		const found = query ? list.filter((note) => matches(note, query)) : list;
		const active = found.filter(isActiveNote);
		counts.open += active.length;
		counts.all += found.length;
		const shown = filters.status === "open" ? active : found;
		if (shown.length === 0) continue;
		groups.push({
			workspace,
			notes: sortNotes(shown),
			lastUpdatedAt: Math.max(...list.map((note) => note.updatedAt)),
		});
	}

	groups.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
	workspaceOptions.sort((a, b) => a.name.localeCompare(b.name));
	return { groups, counts, workspaceOptions };
}
