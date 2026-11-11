import { create } from "zustand";

/**
 * The to-dos view of a workspace's right panel: which conversation it puts
 * first, and a request, made from the sidebar before it navigates, to
 * surface that view once the workspace page is ready. Memory only.
 */
interface TodosPanelState {
	/** `workspaceId → terminalId` of the conversation the user asked for. */
	focusByWorkspace: Record<string, string>;
	/** The workspace whose page should open its to-dos view on arrival. */
	openRequest: string | null;
	/** Focus a conversation and ask its workspace to show the to-dos view. */
	open: (workspaceId: string, terminalId: string) => void;
	setFocus: (workspaceId: string, terminalId: string) => void;
	/** True once per request, for the workspace it was made for. */
	consume: (workspaceId: string) => boolean;
}

export const useTodosPanelStore = create<TodosPanelState>()((set, get) => ({
	focusByWorkspace: {},
	openRequest: null,
	open: (workspaceId, terminalId) =>
		set((state) => ({
			focusByWorkspace: {
				...state.focusByWorkspace,
				[workspaceId]: terminalId,
			},
			openRequest: workspaceId,
		})),
	setFocus: (workspaceId, terminalId) =>
		set((state) =>
			state.focusByWorkspace[workspaceId] === terminalId
				? state
				: {
						focusByWorkspace: {
							...state.focusByWorkspace,
							[workspaceId]: terminalId,
						},
					},
		),
	consume: (workspaceId) => {
		if (get().openRequest !== workspaceId) return false;
		set({ openRequest: null });
		return true;
	},
}));
