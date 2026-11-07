import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface FolderOptions {
	hideConversations: boolean;
	hideIdleConversations: boolean;
	hideSubagents: boolean;
	hideTodos: boolean;
	compactRows: boolean;
}

export type FolderOptionKey = keyof FolderOptions;

export const DEFAULT_FOLDER_OPTIONS: FolderOptions = {
	hideConversations: false,
	hideIdleConversations: false,
	hideSubagents: false,
	hideTodos: false,
	compactRows: false,
};

export type FolderRef =
	| { kind: "project"; id: string }
	| { kind: "group"; id: string };

export const MAX_FOLDER_ENTRIES = 200;

export function folderKey(ref: FolderRef): string {
	return `${ref.kind}:${ref.id}`;
}

interface SidebarFolderOptionsState {
	/** Only folders with an option on; an entry goes away when all are off. */
	byFolder: Record<string, Partial<FolderOptions>>;
	setOption: (ref: FolderRef, key: FolderOptionKey, value: boolean) => void;
	clear: (ref: FolderRef) => void;
}

/**
 * Sidebar options per project and per group. Bounded by MAX_FOLDER_ENTRIES
 * (oldest dropped first); an entry is removed when its last option goes off.
 */
export const useSidebarFolderOptionsStore = create<SidebarFolderOptionsState>()(
	devtools(
		persist(
			(set) => ({
				byFolder: {},
				setOption: (ref, key, value) =>
					set((state) => {
						const id = folderKey(ref);
						const { [id]: current = {}, ...others } = state.byFolder;
						const { [key]: _previous, ...rest } = current;
						const next = value ? { ...rest, [key]: true } : rest;
						if (Object.keys(next).length === 0) return { byFolder: others };
						const kept = Object.entries(others).slice(
							-(MAX_FOLDER_ENTRIES - 1),
						);
						return { byFolder: { ...Object.fromEntries(kept), [id]: next } };
					}),
				clear: (ref) =>
					set((state) => {
						const { [folderKey(ref)]: _removed, ...others } = state.byFolder;
						return { byFolder: others };
					}),
			}),
			{
				name: "sidebar-folder-options-v1",
				partialize: ({ byFolder }) => ({ byFolder }),
			},
		),
		{ name: "SidebarFolderOptions" },
	),
);

/** A group's options add to its project's: either one can turn a part off. */
export function resolveFolderOptions(
	byFolder: Record<string, Partial<FolderOptions>>,
	projectId: string | null,
	groupId: string | null,
): FolderOptions {
	const project = projectId
		? byFolder[folderKey({ kind: "project", id: projectId })]
		: undefined;
	const group = groupId
		? byFolder[folderKey({ kind: "group", id: groupId })]
		: undefined;
	const resolved = { ...DEFAULT_FOLDER_OPTIONS };
	for (const key of Object.keys(DEFAULT_FOLDER_OPTIONS) as FolderOptionKey[]) {
		resolved[key] = Boolean(project?.[key] || group?.[key]);
	}
	return resolved;
}

export function useFolderOption(ref: FolderRef, key: FolderOptionKey): boolean {
	return useSidebarFolderOptionsStore(
		(state) => state.byFolder[folderKey(ref)]?.[key] === true,
	);
}
