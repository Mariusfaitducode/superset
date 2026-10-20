import { create } from "zustand";

export type VisibleTerminalSlot = "center" | "right";

/**
 * The terminal shown in each pane area of the open workspace, so the sidebar
 * can mark the conversation on screen. Memory only: it describes this window.
 */
interface VisibleTerminalsState {
	terminalIdBySlot: Partial<Record<VisibleTerminalSlot, string>>;
	setVisibleTerminal: (
		slot: VisibleTerminalSlot,
		terminalId: string | null,
	) => void;
}

export const useVisibleTerminalsStore = create<VisibleTerminalsState>()(
	(set) => ({
		terminalIdBySlot: {},
		setVisibleTerminal: (slot, terminalId) =>
			set((state) => {
				if ((state.terminalIdBySlot[slot] ?? null) === terminalId) return state;
				const { [slot]: _previous, ...rest } = state.terminalIdBySlot;
				return {
					terminalIdBySlot: terminalId ? { ...rest, [slot]: terminalId } : rest,
				};
			}),
	}),
);

export function useIsTerminalVisible(terminalId: string): boolean {
	return useVisibleTerminalsStore((state) =>
		Object.values(state.terminalIdBySlot).includes(terminalId),
	);
}
