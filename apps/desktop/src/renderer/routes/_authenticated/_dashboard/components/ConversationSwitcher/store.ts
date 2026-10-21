import { create } from "zustand";

interface ConversationSwitcherState {
	open: boolean;
	setOpen: (open: boolean) => void;
}

export const useConversationSwitcherStore = create<ConversationSwitcherState>(
	(set) => ({
		open: false,
		setOpen: (open) => set({ open }),
	}),
);
